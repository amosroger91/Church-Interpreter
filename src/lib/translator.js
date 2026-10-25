// Main-thread side of the translation worker. Keeps latency bounded: only
// one chunk is translated at a time, and any chunks that arrive meanwhile
// are merged into a single follow-up request instead of queueing up.
import { MODELS } from './config.js';

export class Translator {
  constructor({ onResult, onStatus } = {}) {
    this.onResult = onResult || (() => {});
    this.onStatus = onStatus || (() => {});
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
        } else if (m.type === 'result') {
          this._finish(m.text, m.ms);
        } else if (m.type === 'error') {
          if (!this.ready) {
            this.onStatus({ state: 'error', error: m.error });
            this.readyPromise = null;
            this.worker.terminate();
            reject(new Error(m.error));
          } else {
            this.onStatus({ state: 'ready', error: m.error });
            this._finish('', 0);
          }
        }
      };
      this.onStatus({ state: 'loading', loaded: 0, total: 0 });
      this.worker.postMessage({
        type: 'load',
        baseUrl: new URL(import.meta.env.BASE_URL, location.href).href,
        modelId: MODELS.translation.id,
      });
    });
    return this.readyPromise;
  }

  /**
   * Queue an English chunk. `meta` is passed back with the result.
   * Chunks waiting behind a running translation are merged together.
   */
  translate(text, meta = {}) {
    if (!text.trim()) {
      if (meta.final) this.pending.push({ text: '', meta });
    } else {
      this.pending.push({ text, meta });
    }
    this._pump();
  }

  clear() {
    this.pending = [];
  }

  _pump() {
    if (this.busy || !this.ready || this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const text = batch.map((b) => b.text).filter(Boolean).join(' ');
    const meta = {
      start: Boolean(batch[0].meta.start),
      final: batch.some((b) => b.meta.final),
      english: text,
      merged: batch.length,
    };
    if (!text) {
      this.onResult({ text: '', ...meta, ms: 0 });
      return this._pump();
    }
    this.busy = true;
    this.inflight = meta;
    this.worker.postMessage({ type: 'translate', id: this.nextId++, text });
  }

  _finish(text, ms) {
    const meta = this.inflight;
    this.busy = false;
    this.inflight = null;
    if (meta) this.onResult({ text, ms, ...meta });
    this._pump();
  }
}
