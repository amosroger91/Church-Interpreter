import { describe, it, expect } from 'vitest';
import { LiturgyMatcher } from './liturgy.js';

function run(text, opts) {
  const events = [];
  const m = new LiturgyMatcher({
    ...opts,
    onStart: (e) => events.push(['start', e.start]),
    onLine: (e) => events.push(['line', e.text]),
    onEnd: (e) => events.push(['end', e.resumeAt]),
  });
  text.split(' ').forEach((w, i) => m.feed(w, i));
  return events;
}

describe('LiturgyMatcher (Spanish speaker)', () => {
  it("recognizes the Padre Nuestro and gives the traditional English", () => {
    const events = [];
    const m = new LiturgyMatcher({
      from: 'es',
      onStart: (e) => events.push(['start', e.start]),
      onLine: (e) => events.push(['line', e.text]),
      onEnd: (e) => events.push(['end', e.resumeAt]),
    });
    'oremos juntos padre nuestro que estas en el cielo santificado sea tu nombre venga tu reino'
      .split(' ')
      .forEach((w, i) => m.feed(w, i));
    expect(events).toEqual([
      ['start', 2],
      ['line', 'Our Father, which art in heaven,'],
      ['line', 'hallowed be thy name.'],
      ['line', 'Thy kingdom come.'],
    ]);
  });
});

describe('LiturgyMatcher', () => {
  it("recognizes the Lord's Prayer and emits the Spanish line by line", () => {
    const ev = run('let us pray together our father which art in heaven hallowed be thy name thy kingdom come');
    expect(ev).toEqual([
      ['start', 4],
      ['line', 'Padre nuestro que estás en los cielos,'],
      ['line', 'santificado sea tu nombre.'],
      ['line', 'Venga tu reino.'],
    ]);
  });

  it('tolerates wording variants and ends at the amen', () => {
    const ev = run(
      'give us this day our daily bread and forgive us our debts as we forgive our debtors and lead us not into temptation but deliver us from evil for thine is the kingdom and the power and the glory forever amen please be seated',
    );
    const lines = ev.filter((e) => e[0] === 'line').map((e) => e[1]);
    expect(lines).toHaveLength(5);
    expect(lines.at(-1)).toBe('porque tuyo es el reino, y el poder, y la gloria, por todos los siglos. Amén.');
    expect(ev.at(-1)).toEqual(['end', 41]);
  });

  it('gives control back when the speaker stops following the text', () => {
    const ev = run('glory be to the father and to the son because he deserves all the praise we can give');
    expect(ev[0]).toEqual(['start', 0]);
    // "and to the son" was said, but the line was abandoned after "because".
    expect(ev.filter((e) => e[0] === 'line')).toHaveLength(1);
    expect(ev.at(-1)).toEqual(['end', 9]);
  });

  it('does not trigger on ordinary speech', () => {
    expect(run('our father loves us and he wants us to come home to him today')).toEqual([]);
    // One word away from the Creed's "to the dead. On the third day".
    expect(run('come to the potluck in the fellowship hall after the service')).toEqual([]);
  });
});
