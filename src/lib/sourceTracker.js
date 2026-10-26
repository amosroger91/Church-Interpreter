// Feeds the simultaneous translator. Tracks which recognized English words
// are stable (two consecutive recognizer hypotheses agree on them) and groups
// them into segments: one per spoken utterance, split further at a natural
// phrase boundary if someone talks for a long time without pausing (keeps
// each re-translation fast).
import { BOUNDARY_WORDS, normWord, splitWords } from './chunker.js';

function stablePrefix(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && normWord(a[i]) === normWord(b[i])) i++;
  return i;
}

export class SourceTracker {
  /**
   * @param {object} opts
   * @param {(s: {segId, text, final, start}) => void} opts.onSegment
   * @param {(word: string, index: number) => void} [opts.onStable] called
   *   once for every word as it becomes stable (index within the utterance)
   */
  constructor({ maxSegmentWords = 30, quietMs = 600, onSegment, onStable } = {}) {
    this.maxSegmentWords = maxSegmentWords;
    this.quietMs = quietMs;
    this.onSegment = onSegment || (() => {});
    this.onStable = onStable || (() => {});
    this.segId = 0;
    this.paused = false;
    this._resetUtterance();
  }

  _resetUtterance() {
    this.words = [];
    this.stable = 0;
    this.fed = 0;
    this.segStart = 0;
    this.lastSent = '';
    this.lastUpdateAt = 0;
  }

  _feed() {
    while (this.fed < this.stable) {
      const i = this.fed++;
      this.onStable(this.words[i], i);
    }
  }

  /**
   * Stop sending words for translation from utterance word `atIndex` on
   * (something else, e.g. the liturgy matcher, is handling them). The
   * segment in progress is closed with the words before that point.
   */
  pause(atIndex) {
    if (this.paused) return;
    const end = Math.max(this.segStart, atIndex);
    const text = this.words.slice(this.segStart, end).join(' ');
    if (text || this.lastSent) this._send(text, true);
    this.segStart = end;
    this.paused = true;
  }

  /** Resume translating, starting at utterance word `atIndex`. */
  resume(atIndex) {
    this.paused = false;
    this.segStart = Math.max(0, Math.min(atIndex, this.words.length));
    this.lastSent = '';
  }

  /** English already handed to the translator for the current segment. */
  get sentText() {
    return this.lastSent;
  }

  /** Recognized words not yet considered stable. */
  get pendingText() {
    return this.words.slice(Math.max(this.stable, this.segStart)).join(' ');
  }

  update(partialText, now = Date.now()) {
    const words = splitWords(partialText);
    this.stable = stablePrefix(this.words, words);
    this.words = words;
    this.lastUpdateAt = now;
    this._emit();
  }

  tick(now = Date.now()) {
    if (this.words.length && now - this.lastUpdateAt >= this.quietMs && this.stable < this.words.length) {
      this.stable = this.words.length;
      this._emit();
    }
  }

  finalize(finalText) {
    const words = splitWords(finalText);
    this.words = words;
    this.stable = words.length;
    this._feed();
    if (this.paused) {
      this._resetUtterance();
      return;
    }
    const rest = words.slice(this.segStart);
    if (rest.length) {
      this._send(rest.join(' '), true);
    } else if (this.lastSent) {
      this._send(this.lastSent, true);
    }
    this._resetUtterance();
  }

  _emit() {
    this._feed();
    if (this.paused) return;
    for (;;) {
      const avail = this.stable - this.segStart;
      if (avail <= this.maxSegmentWords) break;
      // Close this segment before a phrase boundary if there is one, but
      // never before words already sent (their Spanish may be committed).
      const sentWords = this.lastSent ? this.lastSent.split(' ').length : 0;
      let cut = Math.max(this.maxSegmentWords, sentWords);
      for (let i = this.maxSegmentWords; i >= Math.max(Math.ceil(this.maxSegmentWords / 2), sentWords); i--) {
        if (BOUNDARY_WORDS.has(normWord(this.words[this.segStart + i] || ''))) {
          cut = i;
          break;
        }
      }
      this._send(this.words.slice(this.segStart, this.segStart + cut).join(' '), true);
      this.segStart += cut;
    }
    const text = this.words.slice(this.segStart, this.stable).join(' ');
    if (text && text !== this.lastSent) this._send(text, false);
  }

  _send(text, final) {
    this.onSegment({ segId: this.segId, text, final, start: this.segStart === 0 });
    if (final) {
      this.segId++;
      this.lastSent = '';
    } else {
      this.lastSent = text;
    }
  }
}
