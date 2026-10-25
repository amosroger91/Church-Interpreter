import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StreamChunker } from './lib/chunker.js';
import { Translator } from './lib/translator.js';
import { Speaker } from './lib/speaker.js';
import { prepareEnglish, tidySpanish } from './lib/text.js';
import { VoskEngine } from './lib/asr/vosk.js';
import { WebSpeechEngine } from './lib/asr/webSpeech.js';

export const ENGINES = {
  vosk: VoskEngine,
  webspeech: WebSpeechEngine,
};

// How eagerly to send words for translation. Smaller chunks = less delay,
// larger chunks = more context for the translator = better Spanish.
export const PACES = {
  fast: { label: 'Fast', minWords: 2, maxWords: 5, maxWaitMs: 800 },
  balanced: { label: 'Balanced', minWords: 3, maxWords: 7, maxWaitMs: 1200 },
  accurate: { label: 'Accurate', minWords: 5, maxWords: 11, maxWaitMs: 2000 },
};

const MAX_LINES = 200;

export function useInterpreter(settings) {
  const [status, setStatus] = useState('idle'); // idle | loading | listening
  const [error, setError] = useState(null);
  const [speechModel, setSpeechModel] = useState('idle'); // idle | loading | ready | error
  const [translationModel, setTranslationModel] = useState({ state: 'idle' });
  const [lines, setLines] = useState([]); // [{ id, es, en, done }]
  const [live, setLive] = useState({ committed: '', pending: '' });
  const [level, setLevel] = useState(0);
  const [stats, setStats] = useState({ ms: 0, merged: 1 });

  const speaker = useMemo(() => new Speaker(), []);
  const engineRef = useRef(null);
  const committedRef = useRef('');
  const lineIdRef = useRef(0);

  useEffect(() => {
    speaker.enabled = settings.speak;
    speaker.voiceURI = settings.voiceURI;
    speaker.rate = settings.rate;
    if (!settings.speak) speaker.stop();
  }, [speaker, settings.speak, settings.voiceURI, settings.rate]);

  const translator = useMemo(
    () =>
      new Translator({
        onStatus: (s) => setTranslationModel(s),
        onResult: (r) => {
          const es = tidySpanish(r.text, { final: r.final });
          setStats({ ms: r.ms, merged: r.merged });
          setLines((prev) => {
            let next = prev;
            const last = next[next.length - 1];
            if (!last || last.done || r.start) {
              next = [...next, { id: ++lineIdRef.current, es: '', en: '', done: false }];
            } else {
              next = next.slice();
            }
            const cur = { ...next[next.length - 1] };
            cur.es = [cur.es, es].filter(Boolean).join(' ');
            cur.en = [cur.en, r.english].filter(Boolean).join(' ');
            if (r.final) cur.done = true;
            next[next.length - 1] = cur;
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
          if (es) speaker.speak(es);
        },
      }),
    [speaker],
  );

  const chunker = useMemo(
    () =>
      new StreamChunker({
        ...PACES.balanced,
        onCommit: ({ text, final, start }) => {
          const english = prepareEnglish(text, { start });
          committedRef.current = final ? '' : [committedRef.current, english].filter(Boolean).join(' ');
          translator.translate(english, { start, final });
        },
      }),
    [translator],
  );

  useEffect(() => {
    chunker.setOptions(PACES[settings.pace] || PACES.balanced);
  }, [chunker, settings.pace]);

  // Release slow speech even when the recognizer isn't sending updates.
  useEffect(() => {
    if (status !== 'listening') return undefined;
    const t = setInterval(() => {
      chunker.tick(Date.now());
      setLive({ committed: committedRef.current, pending: chunker.pendingText });
    }, 200);
    return () => clearInterval(t);
  }, [status, chunker]);

  const onPartial = useCallback(
    (text) => {
      chunker.update(text, Date.now());
      setLive({ committed: committedRef.current, pending: chunker.pendingText });
    },
    [chunker],
  );

  const onFinal = useCallback(
    (text) => {
      chunker.finalize(text, Date.now());
      setLive({ committed: '', pending: '' });
    },
    [chunker],
  );

  const loadSpeech = useCallback(async (engineKey) => {
    const Engine = ENGINES[engineKey];
    setSpeechModel('loading');
    try {
      await new Engine({}).load();
      setSpeechModel('ready');
    } catch (e) {
      setSpeechModel('error');
      throw e;
    }
  }, []);

  /** Download and initialize the models ahead of time (for offline use). */
  const prepare = useCallback(async ({ speech = true } = {}) => {
    setError(null);
    try {
      await Promise.all([speech && loadSpeech(settings.engine), translator.load()]);
      return true;
    } catch (e) {
      const msg = e.message || String(e);
      setError(
        navigator.onLine === false || /fetch|network/i.test(msg)
          ? `${msg} — The models (about 120 MB) must be downloaded once with an internet connection; after that the interpreter works offline.`
          : msg,
      );
      return false;
    }
  }, [loadSpeech, settings.engine, translator]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('loading');
    if (!(await prepare())) {
      setStatus('idle');
      return;
    }
    const Engine = ENGINES[settings.engine];
    const engine = new Engine({
      onPartial,
      onFinal,
      onLevel: (rms) => setLevel(Math.min(1, rms * 6)),
      onError: (e) => setError(e.message),
    });
    try {
      await engine.start({ deviceId: settings.deviceId || undefined });
      engineRef.current = engine;
      setStatus('listening');
    } catch (e) {
      engine.stop();
      setError(
        e.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access and try again.'
          : e.message || String(e),
      );
      setStatus('idle');
    }
  }, [prepare, settings.engine, settings.deviceId, onPartial, onFinal]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setStatus('idle');
    setLevel(0);
    // Flush whatever was still pending.
    setTimeout(() => {
      if (chunker.pendingText) chunker.finalize(chunker.pendingText);
      setLive({ committed: '', pending: '' });
    }, 600);
  }, [chunker]);

  const clear = useCallback(() => {
    setLines([]);
    translator.clear();
    speaker.stop();
  }, [translator, speaker]);

  /** Type-to-test: streams typed English word by word like live speech. */
  const simulate = useCallback(
    async (text) => {
      if (!(await prepare({ speech: false }))) return;
      const words = text.trim().split(/\s+/).filter(Boolean);
      for (let i = 1; i <= words.length; i++) {
        onPartial(words.slice(0, i).join(' '));
        await new Promise((r) => setTimeout(r, 280));
      }
      onFinal(words.join(' '));
    },
    [prepare, onPartial, onFinal],
  );

  useEffect(() => () => engineRef.current?.stop(), []);

  return {
    status,
    error,
    speechModel,
    translationModel,
    lines,
    live,
    level,
    stats,
    start,
    stop,
    clear,
    prepare,
    simulate,
    speaker,
  };
}
