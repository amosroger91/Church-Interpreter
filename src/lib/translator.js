// Main-thread side of the translation worker. Keeps latency bounded: only
// one request runs at a time, and requests that pile up meanwhile are
// combined (fragments are merged; for a sentence being re-translated, only
// the newest version is kept) instead of queueing up.
import { MODELS } from './config.js';

export class Translator {
  constructor({ onResult, onStatus, simulOptions } = {}) {
    this.onResult = onResult || (() => {});
    this.onStatus = onStatus || (() => {});
    this.simulOptions = simulOptions || {};
    this.worker = null;
    this.ready = false;
    this.busy = false;
    this.pending = [];
    this.nextId = 1;
    this.inflight = null;
    this.readyPromise = null;
  }

  load() {
    if (this.readyPromise) return this.readyPromise;
    this.worker = new Worker(new URL('./translate.worker.js', import.meta.url), {
      type: 'module',
    });
    this.readyPromise = new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') {
          this.onStatus({ state: 'loading', loaded: m.loaded, total: m.total });
        } else if (m.type === 'ready') {
          this.ready = true;
          this.onStatus({ state: 'ready' });
          resolve();
          this._pump();
        } else if (m.type === 'result') {
          this._finish(m);
        } else if (m.type === 'error') {
          if (!this.ready) {
            this.onStatus({ state: 'error', error: m.error });
            this.readyPromise = null;
            this.worker.terminate();
            reject(new Error(m.error));
          } else {
            this.onStatus({ state: 'ready', error: m.error });
            this._finish({ text: '', committed: '', tentative: '', ms: 0 });
          }
        }
      };
      this.onStatus({ state: 'loading', loaded: 0, total: 0 });
      this.worker.postMessage({
        type: 'load',
        baseUrl: new URL(import.meta.env.BASE_URL, location.href).href,
        modelId: MODELS.translation.id,
        simulOptions: this.simulOptions,
      });
    });
    return this.readyPromise;
  }

  /**
   * Classic mode: queue an independent English chunk. `meta` is passed back
   * with the result. Chunks waiting behind a running translation are merged.
   */
  translate(text, meta = {}) {
    if (text.trim() || meta.final) this.pending.push({ kind: 'fragment', text: text.trim(), meta });
    this._pump();
  }

  /**
   * Sentence-aware mode: the English of segment `segId` so far. Only the
   * newest non-final version of a segment is kept while waiting.
   */
  step({ segId, text, final, start }) {
    if (final) {
      this.pending = this.pending.filter((j) => !(j.kind === 'step' && j.segId === segId && !j.final));
      this.pending.push({ kind: 'step', segId, text, final, start });
    } else {
      const queued = this.pending.find((j) => j.kind === 'step' && j.segId === segId && !j.final);
      if (queued) queued.text = text;
      else this.pending.push({ kind: 'step', segId, text, final, start });
    }
    this._pump();
  }

  clear() {
    this.pending = [];
  }

  _pump() {
    if (this.busy || !this.ready || this.pending.length === 0) return;
    const job = this.pending[0];
    let request;
    if (job.kind === 'step') {
      this.pending.shift();
      this.inflight = { kind: 'step', segId: job.segId, final: job.final, start: job.start, english: job.text };
      request = { type: 'step', segId: job.segId, text: job.text, final: job.final };
    } else {
      // Merge all fragments waiting at the front of the queue.
      let n = 0;
      while (n < this.pending.length && this.pending[n].kind === 'fragment') n++;
      const batch = this.pending.splice(0, n);
      const text = batch.map((b) => b.text).filter(Boolean).join(' ');
      this.inflight = {
        kind: 'fragment',
        start: Boolean(batch[0].meta.start),
        final: batch.some((b) => b.meta.final),
        english: text,
        merged: batch.length,
      };
      if (!text) {
        const meta = this.inflight;
        this.inflight = null;
        this.onResult({ text: '', ...meta, ms: 0 });
        return this._pump();
      }
      request = { type: 'translate', text };
    }
    this.busy = true;
    this.worker.postMessage({ ...request, id: this.nextId++ });
  }

  _finish(m) {
    const meta = this.inflight;
    this.busy = false;
    this.inflight = null;
    if (meta?.kind === 'step') {
      this.onResult({
        ...meta,
        committed: m.committed || '',
        tentative: m.tentative || '',
        ms: m.ms,
        merged: 1,
      });
    } else if (meta) {
      this.onResult({ ...meta, text: m.text || '', ms: m.ms });
    }
    this._pump();
  }
}
