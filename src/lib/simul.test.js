import { describe, it, expect } from 'vitest';
import { SimulTranslator, agreedCommitLength } from './simul.js';

describe('agreedCommitLength', () => {
  const words = new Set([1, 3, 4, 6]); // ids that start a new word
  const isWordStart = (id) => words.has(id);

  it('commits agreed whole words only', () => {
    // prev: [1 2][3][4 5]; cont: [1 2][3][4 7] -> agree on 4 tokens, but
    // token 4 starts a word that is not complete yet.
    expect(agreedCommitLength([1, 2, 3, 4, 5], [1, 2, 3, 4, 7], isWordStart)).toBe(3);
  });
  it('holds back the last word when everything agrees', () => {
    expect(agreedCommitLength([1, 2, 3], [1, 2, 3], isWordStart)).toBe(2);
  });
  it('commits nothing without agreement', () => {
    expect(agreedCommitLength([], [1, 2, 3], isWordStart)).toBe(0);
  });
  it('can hold back extra words', () => {
    expect(agreedCommitLength([1, 2, 3, 4, 6], [1, 2, 3, 4, 6], isWordStart, { holdBackWords: 1 })).toBe(3);
  });
});

// A fake "model" that translates word by word from a dictionary, so we can
// check the prefix forcing and commit logic deterministically.
function fakeSetup(dict) {
  const vocab = new Map([['</s>', 0], ['<pad>', 1]]);
  const id = (tok) => {
    if (!vocab.has(tok)) vocab.set(tok, vocab.size);
    return vocab.get(tok);
  };
  for (const es of Object.values(dict)) for (const w of es.split(' ')) id('▁' + w);
  id('▁.');
  const rev = () => new Map([...vocab].map(([t, i]) => [i, t]));
  const calls = [];
  const tokenizer = (text) => ({ input_ids: { dims: [1, text.split(' ').length] }, text });
  tokenizer.get_vocab = () => vocab;
  tokenizer.decode = (ids) =>
    ids
      .map((i) => rev().get(i))
      .filter((t) => t && !t.startsWith('<'))
      .map((t) => t.slice(1))
      .join(' ')
      .replace(' .', '.');
  const model = {
    config: { eos_token_id: 0, pad_token_id: 1, decoder_start_token_id: 1 },
    async generate({ text, decoder_input_ids }) {
      calls.push(decoder_input_ids);
      const es = text.split(' ').flatMap((w) => (dict[w] ? dict[w].split(' ') : []));
      const full = [1, ...es.map((w) => vocab.get('▁' + w)), vocab.get('▁.'), 0];
      // Respect the forced prefix, then continue with the "translation".
      const forced = decoder_input_ids;
      const tail = full.slice(forced.length);
      return { tolist: () => [[...forced, ...tail]] };
    },
  };
  return { tokenizer, model, calls };
}

describe('SimulTranslator', () => {
  const dict = { the: 'el', lord: 'señor', is: 'es', my: 'mi', shepherd: 'pastor' };

  it('commits words once two passes agree, never the trailing period', async () => {
    const { tokenizer, model, calls } = fakeSetup(dict);
    const st = new SimulTranslator({ tokenizer, model });
    let r = await st.step(0, 'the lord', false);
    expect(r).toMatchObject({ committed: '', tentative: 'el señor' });
    r = await st.step(0, 'the lord is', false);
    expect(r).toMatchObject({ committed: 'el señor', tentative: 'es' });
    r = await st.step(0, 'the lord is my', false);
    // The committed Spanish is forced as the start of this pass.
    expect(calls.at(-1)).toEqual([1, 2, 3]);
    expect(r).toMatchObject({ committed: 'es', tentative: 'mi' });
    r = await st.step(0, 'the lord is my shepherd', true);
    expect(r).toMatchObject({ committed: 'mi pastor.', tentative: '', final: true });
    expect(st.segments.size).toBe(0);
  });
});
