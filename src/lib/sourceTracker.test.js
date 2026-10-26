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

describe('SourceTracker with the liturgy matcher', () => {
  it('hands a recognized prayer to the matcher and resumes translation after it', async () => {
    const { LiturgyMatcher } = await import('./liturgy.js');
    const segs = [];
    const lines = [];
    let matcher;
    const t = new SourceTracker({
      onSegment: (s) => segs.push(s),
      onStable: (w, i) => matcher.feed(w, i),
    });
    matcher = new LiturgyMatcher({
      onStart: ({ start }) => t.pause(start),
      onLine: ({ text }) => lines.push(text),
      onEnd: ({ resumeAt }) => t.resume(resumeAt),
    });
    const words = 'please stand as we pray our father who art in heaven hallowed be thy name amen now open your bibles'.split(' ');
    for (let i = 1; i <= words.length; i++) t.update(words.slice(0, i).join(' '), i * 100);
    t.finalize(words.join(' '));
    expect(lines).toEqual(['Padre nuestro que estás en los cielos,', 'santificado sea tu nombre.']);
    const finals = segs.filter((s) => s.final).map((s) => s.text);
    expect(finals).toEqual(['please stand as we pray', 'amen now open your bibles']);
  });
});

describe('SourceTracker segment splitting', () => {
  it('never cuts a segment before words that were already sent', () => {
    const out = [];
    const t = new SourceTracker({ maxSegmentWords: 8, onSegment: (s) => out.push(s) });
    const words = 'god gives us grace freely even when we do not deserve it'.split(' ');
    for (let i = 1; i <= words.length; i++) t.update(words.slice(0, i).join(' '), i);
    const finals = out.filter((s) => s.final);
    const seg0 = out.filter((s) => s.segId === 0);
    const longestSent = Math.max(...seg0.map((s) => s.text.split(' ').length));
    expect(finals[0].text.split(' ').length).toBeGreaterThanOrEqual(longestSent);
  });
});
