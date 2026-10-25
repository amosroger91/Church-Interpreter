import { describe, it, expect } from 'vitest';
import { StreamChunker } from './chunker.js';

function collect(opts) {
  const out = [];
  const c = new StreamChunker({ ...opts, onCommit: (x) => out.push(x) });
  return { c, out };
}

describe('StreamChunker', () => {
  it('releases words mid-sentence once they are stable', () => {
    const { c, out } = collect({ minWords: 3, maxWords: 5, maxWaitMs: 1000 });
    const partials = [
      'for god',
      'for god so loved',
      'for god so loved the world',
      'for god so loved the world that he gave',
    ];
    let t = 0;
    for (const p of partials) c.update(p, (t += 300));
    // "for god so loved the" is stable (shared by last two hypotheses) and
    // reaches maxWords, so it is sent before the sentence is over.
    expect(out.map((o) => o.text)).toEqual(['for god so loved the']);
    expect(out[0].start).toBe(true);
    expect(out[0].final).toBe(false);
  });

  it('does not commit words the recognizer is still revising', () => {
    const { c, out } = collect({ minWords: 2, maxWords: 4, maxWaitMs: 1000 });
    c.update('the sun', 0);
    c.update('the son of', 100);
    c.update('the son of god is', 200);
    c.update('the son of god is risen', 300);
    expect(out.map((o) => o.text)).toEqual(['the son of god']);
  });

  it('cuts before a phrase boundary when possible', () => {
    const { c, out } = collect({ minWords: 2, maxWords: 6, maxWaitMs: 1000 });
    const s = 'we give thanks because he is good and his mercy endures';
    c.update(s, 0);
    c.update(s + ' forever', 100);
    expect(out[0].text).toBe('we give thanks');
    expect(out[1].text).toBe('because he is good');
  });

  it('releases a short chunk after waiting', () => {
    const { c, out } = collect({ minWords: 3, maxWords: 7, maxWaitMs: 1000 });
    c.update('let us', 0);
    c.update('let us pray', 200);
    expect(out).toHaveLength(0);
    c.tick(1300);
    expect(out.map((o) => o.text)).toEqual(['let us pray']);
  });

  it('flushes the remainder on finalize and resets for the next utterance', () => {
    const { c, out } = collect({ minWords: 2, maxWords: 3, maxWaitMs: 1000 });
    c.update('blessed are the', 0);
    c.update('blessed are the poor in', 100);
    c.finalize('blessed are the poor in spirit', 200);
    expect(out.map((o) => [o.text, o.final])).toEqual([
      ['blessed are the', false],
      ['poor in spirit', true],
    ]);
    c.update('amen', 300);
    c.finalize('amen', 400);
    expect(out.at(-1)).toMatchObject({ text: 'amen', final: true, start: true });
  });

  it('exposes uncommitted words for display', () => {
    const { c } = collect({ minWords: 3, maxWords: 3, maxWaitMs: 1000 });
    c.update('grace and peace to you', 0);
    c.update('grace and peace to you all', 50);
    expect(c.pendingText).toBe('to you all');
  });
});

describe('StreamChunker.tick', () => {
  it('does not treat a still-changing hypothesis as stable', () => {
    const out = [];
    const c = new StreamChunker({ minWords: 2, maxWords: 8, maxWaitMs: 500, quietMs: 600, onCommit: (x) => out.push(x) });
    c.update('he is', 0);
    c.update('he is risen', 100);
    c.tick(550); // waited long enough, but only "he is" is confirmed
    expect(out.map((o) => o.text)).toEqual(['he is']);
    c.tick(800); // quiet now, but one word alone waits a little longer
    expect(out).toHaveLength(1);
    c.tick(1600);
    expect(out.map((o) => o.text)).toEqual(['he is', 'risen']);
  });
});
