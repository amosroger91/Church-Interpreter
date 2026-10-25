// Turns a stream of growing speech-recognition hypotheses into short,
// stable chunks of words that can be translated immediately, without
// waiting for the speaker to finish the sentence.
//
// Recognizers revise their guesses as more audio arrives ("the sun" ->
// "the son of god"). A word is considered stable once two consecutive
// hypotheses agree on it (the common prefix). Stable words are released
// in chunks of `minWords`..`maxWords`, preferring to cut right before a
// natural phrase boundary ("and", "because", "that", ...) so each piece
// translates well on its own.

const BOUNDARY_WORDS = new Set([
  'and', 'but', 'or', 'so', 'because', 'that', 'which', 'who', 'whom',
  'whose', 'when', 'where', 'while', 'if', 'then', 'for', 'until', 'unless',
  'although', 'though', 'since', 'as', 'after', 'before', 'yet', 'nor',
  'therefore', 'amen',
]);

export function splitWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean);
}

function normWord(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && normWord(a[i]) === normWord(b[i])) i++;
  return i;
}

export class StreamChunker {
  constructor({ minWords = 3, maxWords = 7, maxWaitMs = 1200, quietMs = 600, onCommit } = {}) {
    this.minWords = minWords;
    this.quietMs = quietMs;
    this.maxWords = maxWords;
    this.maxWaitMs = maxWaitMs;
    this.onCommit = onCommit || (() => {});
    this.reset();
  }

  reset() {
    this.prevWords = [];
    this.stable = 0;
    this.committed = 0;
    this.lastCommitAt = null;
    this.lastUpdateAt = null;
    this.utteranceStart = true;
  }

  setOptions({ minWords, maxWords, maxWaitMs }) {
    if (minWords != null) this.minWords = minWords;
    if (maxWords != null) this.maxWords = Math.max(maxWords, this.minWords);
    if (maxWaitMs != null) this.maxWaitMs = maxWaitMs;
  }

  /** Words heard but not yet sent for translation (for live display). */
  get pendingText() {
    return this.prevWords.slice(this.committed).join(' ');
  }

  /** Feed the recognizer's current (partial) hypothesis for this utterance. */
  update(partialText, now = Date.now()) {
    const words = splitWords(partialText);
    this.stable = commonPrefixLength(this.prevWords, words);
    this.prevWords = words;
    this.lastUpdateAt = now;
    if (this.lastCommitAt == null) this.lastCommitAt = now;
    this._release(now, false);
  }

  /** Call periodically so slow speech still gets released after maxWaitMs. */
  tick(now = Date.now()) {
    if (this.prevWords.length === 0) return;
    // If the hypothesis hasn't changed for a while, treat it all as stable.
    if (now - this.lastUpdateAt >= this.quietMs) this.stable = this.prevWords.length;
    this._release(now, false);
  }

  /** The recognizer finished an utterance (pause / end of phrase). */
  finalize(finalText, now = Date.now()) {
    const words = splitWords(finalText);
    if (words.length > this.committed) {
      this._emit(words.slice(this.committed), true, now);
    } else if (this.committed > 0) {
      // Nothing new, but let consumers know the sentence ended.
      this.onCommit({ text: '', words: [], final: true, start: false });
    }
    this.reset();
  }

  _release(now, force) {
    for (;;) {
      const available = this.stable - this.committed;
      if (available <= 0) return;
      const waited = now - (this.lastCommitAt ?? now);
      if (available >= this.maxWords) {
        this._emit(this._takeChunk(available), false, now);
        continue;
      }
      if (available >= this.minWords && (force || waited >= this.maxWaitMs)) {
        this._emit(this._takeChunk(available), false, now);
        continue;
      }
      // Very slow speech: release even a short chunk after twice the wait.
      if (available > 0 && waited >= this.maxWaitMs * 2) {
        this._emit(this._takeChunk(available), false, now);
        continue;
      }
      return;
    }
  }

  _takeChunk(available) {
    const limit = Math.min(available, this.maxWords);
    let cut = limit;
    // Prefer cutting right before a boundary word, as late as possible.
    for (let i = limit; i >= this.minWords; i--) {
      const next = this.prevWords[this.committed + i];
      if (next && BOUNDARY_WORDS.has(normWord(next))) {
        cut = i;
        break;
      }
    }
    return this.prevWords.slice(this.committed, this.committed + cut);
  }

  _emit(words, final, now) {
    const start = this.utteranceStart;
    this.committed += words.length;
    this.lastCommitAt = now;
    this.utteranceStart = false;
    this.onCommit({ text: words.join(' '), words, final, start });
  }
}
