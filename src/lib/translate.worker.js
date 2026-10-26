// Runs a translation model (English -> Spanish or Spanish -> English) off the
// main thread. Models: Helsinki-NLP opus-mt-en-es / opus-mt-es-en (MarianMT),
// ONNX-quantized, executed with ONNX Runtime Web (WebAssembly). Works fully
// offline once cached.
import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SimulTranslator } from './simul.js';
import { DIRECTIONS, finishTarget } from './languages.js';
// ONNX Runtime's WebAssembly files, bundled with the app (instead of the
// CDN transformers.js would use) so they are cached for offline use.
import ortAsyncifyMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortAsyncifyWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortPlainMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import ortPlainWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

let translator = null;
let loading = null;

async function configure({ baseUrl, modelId }) {
  // Prefer model files hosted next to the app (see scripts/fetch-models.mjs);
  // fall back to the Hugging Face hub (e.g. in development). Either way they
  // are cached in the browser (Cache Storage) after the first download.
  // Our copy is configured as the "remote" host rather than a local path,
  // because transformers.js checks some files only on the remote host.
  const selfHosted = new URL('models/', baseUrl).href;
  let useSelfHosted = false;
  try {
    const res = await fetch(`${selfHosted}${modelId}/config.json`, { method: 'HEAD' });
    useSelfHosted = res.ok && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    // Offline: use whichever copy was cached when the app was last online
    // (the browser cache is keyed by URL).
    try {
      const cache = await caches.open('transformers-cache');
      useSelfHosted = Boolean(await cache.match(`${selfHosted}${modelId}/config.json`));
    } catch {
      useSelfHosted = false;
    }
  }
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  if (useSelfHosted) {
    env.remoteHost = selfHosted;
    env.remotePathTemplate = '{model}/';
  }
  // Same build selection transformers.js makes by default.
  const ua = self.navigator?.userAgent || '';
  const oldSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua) && !self.navigator?.gpu;
  env.backends.onnx.wasm.wasmPaths = oldSafari
    ? { mjs: new URL(ortPlainMjs, self.location.href).href, wasm: new URL(ortPlainWasm, self.location.href).href }
    : { mjs: new URL(ortAsyncifyMjs, self.location.href).href, wasm: new URL(ortAsyncifyWasm, self.location.href).href };
}

async function load(msg) {
  if (translator) return translator;
  if (!loading) {
    loading = (async () => {
      await configure(msg);
      const progress = {};
      const progress_callback = (p) => {
        if (p.status === 'progress' && p.file) {
          progress[p.file] = { loaded: p.loaded, total: p.total };
          let loaded = 0;
          let total = 0;
          for (const f of Object.values(progress)) {
            loaded += f.loaded || 0;
            total += f.total || 0;
          }
          self.postMessage({ type: 'progress', loaded, total });
        }
      };
      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(msg.modelId, { progress_callback }),
        AutoModelForSeq2SeqLM.from_pretrained(msg.modelId, { dtype: 'q8', device: 'wasm', progress_callback }),
      ]);
      const { direction } = msg;
      translator = new SimulTranslator({
        tokenizer,
        model,
        // Church glossary and output fixes for this direction.
        postprocess: (text) => finishTarget(text, direction),
        holdWords: new Set(DIRECTIONS[direction].holdWords),
        ...msg.simulOptions,
      });
      return translator;
    })();
  }
  return loading;
}

self.onmessage = async (e) => {
  const msg = e.data;
  const started = performance.now();
  try {
    if (msg.type === 'load') {
      const t = await load(msg);
      // Warm up so the first real chunk is fast.
      await t.translate('Hello.');
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'configure') {
      translator?.configure(msg.options);
    } else if (msg.type === 'translate') {
      const text = await translator.translate(msg.text);
      self.postMessage({ type: 'result', id: msg.id, text, ms: Math.round(performance.now() - started) });
    } else if (msg.type === 'step') {
      const r = await translator.step(msg.segId, msg.text, msg.final);
      self.postMessage({ type: 'result', id: msg.id, ...r, ms: Math.round(performance.now() - started) });
    }
  } catch (err) {
    if (msg.type === 'load') loading = null;
    if (msg.type === 'step') translator?.dropSegment(msg.segId);
    self.postMessage({ type: 'error', id: msg.id, error: String(err?.message || err) });
  }
};
