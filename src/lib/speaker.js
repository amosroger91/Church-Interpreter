// Speaks the Spanish translation with the device's built-in voices
// (speechSynthesis). Installed OS voices work offline. If the voice falls
// behind the speaker, queued text is merged and read a little faster so
// the interpretation never drifts far behind.

export function listSpanishVoices() {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().startsWith('es'))
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
}

export class Speaker {
  constructor() {
    this.enabled = true;
    this.voiceURI = null;
    this.rate = 1.1;
    this.queue = [];
    this.speaking = false;
    this.onQueueChange = () => {};
  }

  get supported() {
    return typeof speechSynthesis !== 'undefined';
  }

  speak(text) {
    if (!this.enabled || !this.supported || !text.trim()) return;
    this.queue.push(text.trim());
    this._next();
  }

  stop() {
    this.queue = [];
    this.speaking = false;
    if (this.supported) speechSynthesis.cancel();
    this.onQueueChange(0);
  }

  _next() {
    this.onQueueChange(this.queue.length);
    if (this.speaking || this.queue.length === 0) return;
    // Merge everything waiting into one utterance (fewer gaps, less lag).
    const text = this.queue.join(' ');
    const backlog = text.split(/\s+/).length;
    this.queue = [];
    const u = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === this.voiceURI)
      || listSpanishVoices()[0];
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'es-ES';
    // Speed up a bit when there's a lot to catch up on.
    const boost = backlog > 25 ? 0.35 : backlog > 14 ? 0.2 : 0;
    u.rate = Math.min(2, this.rate + boost);
    const done = () => {
      if (u._done) return;
      u._done = true;
      this.speaking = false;
      this._next();
    };
    u.onend = done;
    u.onerror = done;
    this.speaking = true;
    speechSynthesis.speak(u);
  }
}
