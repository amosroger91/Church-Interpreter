// Browser speech recognition (Web Speech API). More accurate than the small
// offline model and needs no download, but in most browsers the audio is
// processed by the browser vendor's servers, so it needs internet.
import { openLevelMeter } from './microphone.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export class WebSpeechEngine {
  static label = 'Navegador (Web Speech, requiere internet)';
  static supported = Boolean(SR);

  constructor({ onPartial, onFinal, onLevel, onError }) {
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onLevel = onLevel || (() => {});
    this.onError = onError || (() => {});
    this.rec = null;
    this.running = false;
    this.meter = null;
  }

  async load() {
    if (!SR) throw new Error('This browser does not support the Web Speech API. Try Chrome or Edge, or use the offline engine.');
  }

  async start({ deviceId } = {}) {
    await this.load();
    this.running = true;
    try {
      this.meter = await openLevelMeter({ deviceId, onLevel: this.onLevel });
    } catch {
      // The level meter is optional.
    }
    this._startRecognizer();
  }

  _startRecognizer() {
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Index of the first result that has not been finalized yet.
    let firstOpen = 0;
    rec.onresult = (e) => {
      for (let i = Math.max(firstOpen, e.resultIndex); i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal && i === firstOpen) {
          this.onFinal(r[0].transcript);
          firstOpen = i + 1;
        }
      }
      let partial = '';
      for (let i = firstOpen; i < e.results.length; i++) partial += e.results[i][0].transcript;
      if (partial.trim()) this.onPartial(partial);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.running = false;
      this.onError(new Error('Speech recognition error: ' + e.error));
    };
    // Browsers stop recognition after a while; keep it going.
    rec.onend = () => {
      if (this.running) setTimeout(() => this.running && this._startRecognizer(), 100);
    };
    this.rec = rec;
    rec.start();
  }

  stop() {
    this.running = false;
    this.rec?.stop();
    this.rec = null;
    this.meter?.close();
    this.meter = null;
  }
}
