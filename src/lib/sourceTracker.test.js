import { describe, it, expect } from 'vitest';
import { SourceTracker } from './sourceTracker.js';

function collect(opts) {
  const out = [];
  const t = new SourceTracker({ ...opts, onSegment: (s) => out.push(s) });
  return { t, out };
}

describe('SourceTracker', () => {
  it('sends the growing stable sentence, then the final version', () => {
    const { t, out } = collect();
    t.update('the lord', 0);
    t.update('the lord is my', 100);
    t.update('the lord is my shepherd', 200);
    t.finalize('the lord is my shepherd i shall not want');
    expect(out).toEqual([
      { segId: 0, text: 'the lord', final: false, start: true },
      { segId: 0, text: 'the lord is my', final: false, start: true },
      { segId: 0, text: 'the lord is my shepherd i shall not want', final: true, start: true },
    ]);
  });

  it('only sends words two hypotheses agree on', () => {
    const { t, out } = collect();
    t.update('the sun', 0);
    t.update('the son of', 100);
    expect(out.map((o) => o.text)).toEqual(['the']);
  });

  it('trusts the whole hypothesis after a quiet moment', () => {
    const { t, out } = collect({ quietMs: 500 });
    t.update('let us pray', 0);
    t.tick(600);
    expect(out.at(-1)).toMatchObject({ text: 'let us pray', final: false });
  });

  it('splits long run-on speech at a phrase boundary', () => {
    const { t, out } = collect({ maxSegmentWords: 8 });
    const s = 'we are gathered here today to worship and to hear the word of god together';
    t.update(s, 0);
    t.update(s + ' amen', 100);
    const finals = out.filter((o) => o.final);
    expect(finals[0]).toMatchObject({ segId: 0, text: 'we are gathered here today to worship', start: true });
    expect(out.at(-1)).toMatchObject({ segId: 1, final: false, start: false });
    expect(out.at(-1).text.startsWith('and to hear')).toBe(true);
  });

  it('starts a new segment after each utterance', () => {
    const { t, out } = collect();
    t.finalize('amen');
    t.update('please be seated', 0);
    t.update('please be seated', 50);
    expect(out.map((o) => [o.segId, o.text, o.final])).toEqual([
      [0, 'amen', true],
      [1, 'please be seated', false],
    ]);
  });
});
