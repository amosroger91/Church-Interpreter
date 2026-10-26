// Offline streaming speech recognition: Vosk (Kaldi) compiled to WebAssembly.
// Emits partial hypotheses continuously while someone talks, and a final
// result at each pause. The model is stored in IndexedDB after first load.
import { MODELS, appUrl } from '../config.js';
import { openMicrophone } from './microphone.js';

let modelPromise = null;

// vosk-browser stores the model in IndexedDB keyed by its URL, so the same
// URL must be used offline as when it was downloaded.
const URL_KEY = 'vosk-model-url';

function rememberedUrl() {
  try {
    return localStorage.getItem(URL_KEY);
  } catch {
    return null;
  }
}

async function resolveModelUrl() {
  const local = appUrl('models/' + MODELS.speech.file);
  try {
    const res = await fetch(local, { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    if (res.ok && !type.includes('text/html')) return local;
  } catch {
    // Offline: reuse the URL the stored model was downloaded from.
    return rememberedUrl() || MODELS.speech.fallbackUrl;
  }
  return MODELS.speech.fallbackUrl;
}

export function loadVoskModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { Model } = await import('vosk-browser');
      const url = await resolveModelUrl();
      const model = new Model(url);
      return new Promise((resolve, reject) => {
        model.on('load', (m) => {
          if (!m.result) return reject(new Error('Speech model failed to load'));
          try {
            localStorage.setItem(URL_KEY, url);
          } catch {
            // storage unavailable
          }
          resolve(model);
        });
        model.on('error', (m) => {
          // Stop the Web Worker directly; model.terminate() assumes a loaded model.
          model.worker?.terminate();
          reject(new Error('Could not load the speech model: ' + m.error));
        });
      });
    })();
    modelPromise.catch(() => (modelPromise = null));
  }
  return modelPromise;
}

export class VoskEngine {
  constructor({ onPartial, onFinal, onLevel, onError }) {
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onLevel = onLevel || (() => {});
    this.onError = onError || (() => {});
    this.mic = null;
    this.recognizer = null;
  }


  load() {
    return loadVoskModel();
  }

  async start({ deviceId } = {}) {
    const model = await loadVoskModel();
    let recognizer = null;
    this.mic = await openMicrophone({
      deviceId,
      onFrame: (samples, sampleRate, rms) => {
        this.onLevel(rms);
        if (!recognizer) {
          recognizer = new model.KaldiRecognizer(sampleRate);
          recognizer.on('partialresult', (m) => this.onPartial(m.result.partial || ''));
          recognizer.on('result', (m) => this.onFinal(m.result.text || ''));
          recognizer.on('error', (m) => this.onError(new Error(m.error)));
          this.recognizer = recognizer;
        }
        recognizer.acceptWaveformFloat(samples, sampleRate);
      },
    });
  }

  stop() {
    this.mic?.close();
    this.mic = null;
    if (this.recognizer) {
      try {
        this.recognizer.retrieveFinalResult();
        const r = this.recognizer;
        setTimeout(() => r.remove(), 500);
      } catch {
        // ignore
      }
      this.recognizer = null;
    }
  }
}
