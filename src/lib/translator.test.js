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
