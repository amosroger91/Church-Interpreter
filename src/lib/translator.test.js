import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake worker: answers "load" immediately, holds "translate" requests until
// the test releases them, so we can check how chunks queue up.
class FakeWorker {
  static last = null;
  constructor() {
    this.requests = [];
    FakeWorker.last = this;
  }
  postMessage(m) {
    if (m.type === 'load') queueMicrotask(() => this.onmessage({ data: { type: 'ready' } }));
    else this.requests.push(m);
  }
  reply(text) {
    const req = this.requests.shift();
    this.onmessage({ data: { type: 'result', id: req.id, text, ms: 5 } });
  }
  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('location', { href: 'http://localhost/' });
});

describe('Translator', () => {
  it('merges chunks that arrive while a translation is running', async () => {
    const { Translator } = await import('./translator.js');
    const results = [];
    const t = new Translator({ onResult: (r) => results.push(r) });
    await t.load();
    const w = FakeWorker.last;

    t.translate('For God so loved', { start: true });
    t.translate('the world', {});
    t.translate('that he gave', { final: true });
    expect(w.requests.map((r) => r.text)).toEqual(['For God so loved']);

    w.reply('Porque de tal manera amó Dios');
    expect(w.requests.map((r) => r.text)).toEqual(['the world that he gave']);

    w.reply('al mundo que dio');
    expect(results).toMatchObject([
      { text: 'Porque de tal manera amó Dios', start: true, final: false, merged: 1 },
      { text: 'al mundo que dio', start: false, final: true, merged: 2 },
    ]);
  });
});

describe('Translator.step', () => {
  it('keeps only the newest version of a segment while busy, never dropping finals', async () => {
    const { Translator } = await import('./translator.js');
    const results = [];
    const t = new Translator({ onResult: (r) => results.push(r) });
    await t.load();
    const w = FakeWorker.last;
    const answer = (committed) => {
      const req = w.requests.shift();
      w.onmessage({ data: { type: 'result', id: req.id, committed, tentative: '', ms: 1 } });
    };

    t.step({ segId: 0, text: 'the lord', final: false, start: true });
    t.step({ segId: 0, text: 'the lord is', final: false, start: true });
    t.step({ segId: 0, text: 'the lord is my', final: false, start: true });
    expect(w.requests.map((r) => r.text)).toEqual(['the lord']);
    answer('');
    // The intermediate "the lord is" was superseded.
    expect(w.requests.map((r) => [r.type, r.text])).toEqual([['step', 'the lord is my']]);
    t.step({ segId: 0, text: 'the lord is my shepherd', final: false, start: true });
    t.step({ segId: 0, text: 'the lord is my shepherd i shall not want', final: true, start: true });
    t.step({ segId: 1, text: 'amen', final: false, start: true });
    answer('el señor');
    expect(w.requests.map((r) => [r.text, r.final])).toEqual([['the lord is my shepherd i shall not want', true]]);
    answer('es mi pastor, nada me faltará.');
    expect(w.requests.map((r) => [r.segId, r.text])).toEqual([[1, 'amen']]);
    expect(results.map((r) => [r.segId, r.committed, r.final])).toEqual([
      [0, '', false],
      [0, 'el señor', false],
      [0, 'es mi pastor, nada me faltará.', true],
    ]);
  });
});
