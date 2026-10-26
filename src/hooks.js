// Hooks used by the interface: saved settings, screen wake lock, voices and
// microphones.
import { useEffect, useState } from 'react';
import { listVoices } from './lib/speaker.js';

export const DEFAULTS = {
  // The interface is Spanish unless someone picks English with the switch.
  uiLang: 'es',
  uiLangChosen: false,
  // Who is speaking: English speaker translated to Spanish, or the reverse.
  direction: 'en-es',
  engine: 'vosk',
  mode: 'simul',
  liturgy: true,
  pace: 'balanced',
  speak: true,
  voices: { es: '', en: '' },
  rate: 1.1,
  fontSize: 44,
  deviceId: '',
  showSource: true,
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('interpreter-settings') || '{}');
    // Earlier versions saved an auto-detected language; only keep a choice.
    if (!saved.uiLangChosen) delete saved.uiLang;
    // Older versions: a single (Spanish) voice and "show English".
    if (saved.voiceURI !== undefined) saved.voices = { es: saved.voiceURI, en: '' };
    if (saved.showEnglish !== undefined) saved.showSource = saved.showEnglish;
    delete saved.voiceURI;
    delete saved.showEnglish;
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = () =>
      navigator.wakeLock.request('screen').then((l) => {
        if (cancelled) l.release();
        else lock = l;
      }, () => {});
    acquire();
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [active]);
}

export function useVoices(lang) {
  const [voices, setVoices] = useState(() => listVoices(lang));
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return undefined;
    const update = () => setVoices(listVoices(lang));
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, [lang]);
  return voices;
}

export function useMicrophones(refreshKey) {
  const [mics, setMics] = useState([]);
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(
      (d) => setMics(d.filter((x) => x.kind === 'audioinput' && x.deviceId)),
      () => {},
    );
  }, [refreshKey]);
  return mics;
}

/** Settings kept in this browser (localStorage). */
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    try {
      localStorage.setItem('interpreter-settings', JSON.stringify(settings));
    } catch {
      // storage unavailable
    }
  }, [settings]);
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  return [settings, set];
}
