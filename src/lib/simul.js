// Simultaneous (incremental) translation with an encoder-decoder model.
//
// Instead of translating each short fragment on its own, we re-translate the
// whole sentence-so-far every time more English arrives. The Spanish that has
// already been shown/spoken is forced as the start of the output, so the
// model continues the sentence coherently (correct gender, word order and
// agreement with what came before). New Spanish words are only committed once
// two consecutive translations agree on them ("local agreement"), and only up
// to a whole-word boundary. Works in the browser and in Node.

export function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * How many tokens of the new continuation `cont` can be committed, given the
 * previous continuation `prev`. Only whole words that both agree on are
 * committed: the cut must fall right before a token that starts a new word.
 */
export function agreedCommitLength(prevs, cont, isWordStart, { holdBackWords = 0 } = {}) {
  // `prevs`: earlier continuations; all of them must agree with `cont`.
  const list = Array.isArray(prevs[0]) || prevs.length === 0 ? prevs : [prevs];
  let agree = list.length ? cont.length : 0;
  for (const p of list) agree = Math.min(agree, commonPrefixLength(p, cont));
  let k = agree;
  // The token right after the cut must start a new word; otherwise the last
  // agreed word might still be extended with more sub-word pieces.
  while (k > 0 && !(k < cont.length && isWordStart(cont[k]))) k--;
  for (let h = 0; h < holdBackWords && k > 0; h++) {
    k--;
    while (k > 0 && !isWordStart(cont[k])) k--;
  }
  return k;
}

const SENTENCE_END = /^[\s▁]*[.!?…;:]+[\s▁]*$/;

export class SimulTranslator {
  /**
   * @param {object} opts
   * @param {*} opts.tokenizer transformers.js tokenizer (Marian)
   * @param {*} opts.model transformers.js AutoModelForSeq2SeqLM
   * @param {number} [opts.agreeDepth] how many consecutive translations must
   *   agree before words are committed (2 = this one and the previous one)
   * @param {number} [opts.holdBackWords] extra agreed words to keep tentative
   * @param {number} [opts.minSourceWords] English words a segment needs before
   *   anything is committed (the first words of a sentence are the most
   *   ambiguous, e.g. "for God" -> "Por Dios" vs. "Porque Dios")
   */
  constructor({ tokenizer, model, agreeDepth = 2, holdBackWords = 0, minSourceWords = 0 }) {
    this.minSourceWords = minSourceWords;
    this.tokenizer = tokenizer;
    this.model = model;
    this.agreeDepth = Math.max(2, agreeDepth);
    this.holdBackWords = holdBackWords;
    const cfg = model.config || {};
    this.startId = cfg.decoder_start_token_id ?? cfg.pad_token_id ?? 0;
    this.specialIds = new Set(
      [cfg.eos_token_id, cfg.pad_token_id, cfg.decoder_start_token_id, cfg.bos_token_id]
        .flat()
        .filter((x) => x != null),
    );
    // transformers.js only forwards generate() arguments listed in the
    // model's forward_params; Marian's list omits decoder_input_ids, which
    // would silently drop the forced prefix.
    if (Array.isArray(model.forward_params) && !model.forward_params.includes('decoder_input_ids')) {
      model.forward_params = [...model.forward_params, 'decoder_input_ids'];
    }
    this.idToToken = [];
    for (const [tok, id] of tokenizer.get_vocab()) this.idToToken[id] = tok;
    this.segments = new Map();
  }

  isWordStart = (id) => {
    const t = this.idToToken[id] || '';
    return t.startsWith('▁') || this.specialIds.has(id);
  };

  _isSentenceEnd(id) {
    return SENTENCE_END.test(this.idToToken[id] || '');
  }

  decode(ids) {
    if (ids.length === 0) return '';
    return this.tokenizer.decode(ids, { skip_special_tokens: true }).trim();
  }

  async _generate(source, prefix) {
    const inputs = this.tokenizer(source);
    const srcLen = inputs.input_ids.dims.at(-1);
    // Forcing a prefix sometimes makes the model start over with the word it
    // was just given ("que que", "su su"); forbid repeating the last word.
    let badWords = null;
    if (prefix.length) {
      let i = prefix.length - 1;
      while (i > 0 && !this.isWordStart(prefix[i])) i--;
      const lastWord = prefix.slice(i);
      badWords = [[...lastWord, lastWord[0]]];
    }
    const out = await this.model.generate({
      ...inputs,
      decoder_input_ids: [this.startId, ...prefix],
      bad_words_ids: badWords,
      // Budget for the new tokens only (the model stops at end-of-sentence).
      max_new_tokens: Math.ceil(srcLen * 1.5) + 10,
      num_beams: 1,
      do_sample: false,
    });
    const ids = Array.from(out.tolist()[0], Number);
    if (prefix.some((id, i) => ids[i + 1] !== id)) {
      throw new Error('Translation model did not keep the forced prefix');
    }
    const cont = ids.slice(prefix.length + 1);
    // Drop end-of-sentence / padding tokens.
    const end = cont.findIndex((id) => this.specialIds.has(id));
    return end === -1 ? cont : cont.slice(0, end);
  }

  /** Plain one-shot translation (used by the classic fragment mode). */
  async translate(text) {
    return this.decode(await this._generate(text, []));
  }

  /**
   * Advance the translation of segment `segId`, whose English so far is
   * `source`. When `final` is true the segment is complete and everything is
   * committed. Returns the newly committed Spanish plus a tentative tail.
   */
  async step(segId, source, final) {
    if (!source.trim()) {
      this.segments.delete(segId);
      return { segId, committed: '', tentative: '', final };
    }
    const seg = this.segments.get(segId) || { committed: [], history: [] };
    let cont = await this._generate(source, seg.committed);

    let commit;
    if (final) {
      commit = cont;
    } else {
      // A translation of an unfinished sentence usually ends with a period
      // the speaker hasn't said yet; never commit trailing punctuation.
      while (cont.length && this._isSentenceEnd(cont[cont.length - 1])) cont = cont.slice(0, -1);
      const enoughContext = source.trim().split(/\s+/).length >= this.minSourceWords;
      const k =
        enoughContext && seg.history.length >= this.agreeDepth - 1
          ? agreedCommitLength(seg.history, cont, this.isWordStart, { holdBackWords: this.holdBackWords })
          : 0;
      commit = cont.slice(0, k);
    }

    const before = this.decode(seg.committed);
    const nextCommitted = seg.committed.concat(commit);
    const after = this.decode(nextCommitted);
    const committedText = after.startsWith(before) ? after.slice(before.length).trim() : this.decode(commit);
    const rest = cont.slice(commit.length);
    const full = this.decode(nextCommitted.concat(rest));
    const tentative = full.startsWith(after) ? full.slice(after.length).trim() : this.decode(rest);

    if (final) {
      this.segments.delete(segId);
    } else {
      // Keep the latest translations (re-aligned after the new commit) for
      // the next agreement check.
      const n = commit.length;
      const history = [...seg.history, cont]
        .slice(-(this.agreeDepth - 1))
        .map((h) => h.slice(n));
      this.segments.set(segId, { committed: nextCommitted, history });
    }
    return { segId, committed: committedText, tentative: final ? '' : tentative, final };
  }

  dropSegment(segId) {
    this.segments.delete(segId);
  }
}
