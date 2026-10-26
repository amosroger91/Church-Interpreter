// Runs the English -> Spanish translation model off the main thread.
// Model: Helsinki-NLP opus-mt-en-es (MarianMT), ONNX-quantized, executed
// with ONNX Runtime Web (WebAssembly). Works fully offline once cached.
import { env, AutoTokenizer, AutoModelForSeq2SeqLM } from '@huggingface/transformers';
import { SimulTranslator } from './simul.js';

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
    // offline: rely on the browser cache, which is keyed by the URLs below
    useSelfHosted = true;
  }
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  if (useSelfHosted) {
    env.remoteHost = selfHosted;
    env.remotePathTemplate = '{model}/';
  }
  // Load the ONNX Runtime WebAssembly binary from our own site instead of a
  // CDN (same build selection transformers.js makes by default).
  const ua = self.navigator?.userAgent || '';
  const oldSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua) && !self.navigator?.gpu;
  const name = oldSafari ? 'ort-wasm-simd-threaded' : 'ort-wasm-simd-threaded.asyncify';
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(`ort/${name}.mjs`, baseUrl).href,
    wasm: new URL(`ort/${name}.wasm`, baseUrl).href,
  };
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
      translator = new SimulTranslator({ tokenizer, model, ...msg.simulOptions });
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
