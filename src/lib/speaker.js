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

  /**
   * Browsers (iOS Safari in particular) only allow speech that starts from a
   * user gesture. Call this from a click handler; once one utterance has
   * been spoken, later ones triggered by translations are allowed.
   */
  unlock() {
    if (!this.supported || this.unlocked) return;
    this.unlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = 'es-ES';
    speechSynthesis.speak(u);
    // Chrome pauses speech after a period of inactivity; make sure it runs.
    speechSynthesis.resume();
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
    let timer = null;
    const done = () => {
      if (u._done) return;
      u._done = true;
      clearTimeout(timer);
      if (this.current === u) this.current = null;
      this.speaking = false;
      this._next();
    };
    u.onend = done;
    u.onerror = done;
    // Some browsers occasionally never fire onend, which would silence the
    // voice for the rest of the service; move on after a generous estimate.
    timer = setTimeout(done, 4000 + (backlog / (2.5 * u.rate)) * 1000 * 1.5);
    // Keep a reference: Chrome can garbage-collect a speaking utterance.
    this.current = u;
    this.speaking = true;
    speechSynthesis.speak(u);
  }
}
