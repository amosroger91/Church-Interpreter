// Runs the English -> Spanish translation model off the main thread.
// Model: Helsinki-NLP opus-mt-en-es (MarianMT), ONNX-quantized, executed
// with ONNX Runtime Web (WebAssembly). Works fully offline once cached.
import { env, pipeline } from '@huggingface/transformers';

let translator = null;
let loading = null;

function configure({ baseUrl, modelId }) {
  // Prefer model files hosted next to the app (see scripts/fetch-models.mjs);
  // fall back to the Hugging Face hub. Either way they are cached in the
  // browser (Cache Storage) after the first download.
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.localModelPath = new URL('models/', baseUrl).href;
  env.useBrowserCache = true;
  // Load the ONNX Runtime WebAssembly binary from our own site instead of a
  // CDN (same build selection transformers.js makes by default).
  const ua = self.navigator?.userAgent || '';
  const oldSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua) && !self.navigator?.gpu;
  const name = oldSafari ? 'ort-wasm-simd-threaded' : 'ort-wasm-simd-threaded.asyncify';
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(`ort/${name}.mjs`, baseUrl).href,
    wasm: new URL(`ort/${name}.wasm`, baseUrl).href,
  };
  return modelId;
}

async function load(msg) {
  if (translator) return translator;
  if (!loading) {
    const modelId = configure(msg);
    const progress = {};
    loading = pipeline('translation', modelId, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
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
      },
    }).then((t) => (translator = t));
  }
  return loading;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      await load(msg);
      // Warm up so the first real chunk is fast.
      await translator('Hello.', { max_new_tokens: 16 });
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'translate') {
      const t = await load(msg);
      const started = performance.now();
      const out = await t(msg.text, { max_new_tokens: 128, num_beams: 1 });
      self.postMessage({
        type: 'result',
        id: msg.id,
        text: out[0]?.translation_text ?? '',
        ms: Math.round(performance.now() - started),
      });
    }
  } catch (err) {
    loading = null;
    self.postMessage({ type: 'error', id: msg.id, error: String(err?.message || err) });
  }
};
