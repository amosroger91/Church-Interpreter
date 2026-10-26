import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StreamChunker } from './lib/chunker.js';
import { SourceTracker } from './lib/sourceTracker.js';
import { LiturgyMatcher } from './lib/liturgy.js';
import { SIMUL_PACES } from './lib/simul.js';
import { Translator } from './lib/translator.js';
import { Speaker } from './lib/speaker.js';
import { prepareEnglish, tidySpanish } from './lib/text.js';
import { VoskEngine } from './lib/asr/vosk.js';
import { WebSpeechEngine } from './lib/asr/webSpeech.js';

export const ENGINES = {
  vosk: VoskEngine,
  webspeech: WebSpeechEngine,
};

// How eagerly to commit translations. In sentence-aware mode this selects
// SIMUL_PACES; in classic mode, the chunk size (smaller = less delay, larger
// = more context for the translator = better Spanish).
export const PACES = {
  fast: { minWords: 2, maxWords: 5, maxWaitMs: 800 },
  balanced: { minWords: 3, maxWords: 7, maxWaitMs: 1200 },
};

// How the English is fed to the translator (labels are in src/i18n.js).
export const MODES = { simul: true, fragment: true };

const MAX_LINES = 200;

function trimLines(lines) {
  return lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines;
}

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
          setStats({ ms: r.ms, merged: r.merged });
          if (r.kind === 'step') {
            // Sentence-aware mode: one caption line per segment, with the
            // committed Spanish plus a tentative tail that may still change.
            const key = 's' + r.segId;
            setLines((prev) => {
              const idx = prev.findLastIndex((l) => l.key === key);
              const cur = idx >= 0 ? { ...prev[idx] } : { id: ++lineIdRef.current, key, es: '', en: '', done: false };
              cur.es = [cur.es, r.committed].filter(Boolean).join(' ');
              cur.tentative = r.tentative;
              cur.en = r.english;
              cur.done = r.final;
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = cur;
                return next;
              }
              return trimLines([...prev, cur]);
            });
            if (r.committed) speaker.speak(r.committed);
            return;
          }
          const es = tidySpanish(r.text, { final: r.final });
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
            return trimLines(next);
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

  const liturgyOnRef = useRef(settings.liturgy);
  liturgyOnRef.current = settings.liturgy;

  const tracker = useMemo(() => {
    const t = new SourceTracker({
      onSegment: ({ segId, text, final, start }) => {
        translator.step({ segId, text: prepareEnglish(text, { start }), final, start });
      },
      onStable: (word, index) => {
        if (liturgyOnRef.current) matcher.feed(word, index);
      },
    });
    // Known prayers and creeds are shown with their standard Spanish wording
    // instead of being machine-translated.
    const matcher = new LiturgyMatcher({
      onStart: ({ start }) => t.pause(start),
      onLine: ({ es, title }) => {
        setLines((prev) =>
          trimLines([...prev, { id: ++lineIdRef.current, key: 'l' + lineIdRef.current, es, en: title, done: true, liturgy: true }]),
        );
        speaker.speak(es);
      },
      onEnd: ({ resumeAt }) => t.resume(resumeAt),
    });
    return t;
  }, [translator, speaker]);

  useEffect(() => {
    chunker.setOptions(PACES[settings.pace] || PACES.balanced);
    translator.configure(SIMUL_PACES[settings.pace] || SIMUL_PACES.balanced);
  }, [chunker, translator, settings.pace]);

  const simul = settings.mode !== 'fragment';
  const liveText = useCallback(
    () =>
      simul
        ? { committed: tracker.sentText, pending: tracker.pendingText }
        : { committed: committedRef.current, pending: chunker.pendingText },
    [simul, tracker, chunker],
  );

  // Release slow speech even when the recognizer isn't sending updates.
  useEffect(() => {
    if (status !== 'listening') return undefined;
    const t = setInterval(() => {
      if (simul) tracker.tick(Date.now());
      else chunker.tick(Date.now());
      setLive(liveText());
    }, 200);
    return () => clearInterval(t);
  }, [status, simul, tracker, chunker, liveText]);

  const onPartial = useCallback(
    (text) => {
      if (simul) tracker.update(text, Date.now());
      else chunker.update(text, Date.now());
      setLive(liveText());
    },
    [simul, tracker, chunker, liveText],
  );

  const onFinal = useCallback(
    (text) => {
      if (simul) tracker.finalize(text);
      else chunker.finalize(text, Date.now());
      setLive({ committed: '', pending: '' });
    },
    [simul, tracker, chunker],
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
      // Errors are { code, detail }; the UI shows `code` in its language.
      setError(
        navigator.onLine === false || /fetch|network/i.test(msg)
          ? { code: 'errNeedsInternet', detail: msg }
          : { detail: msg },
      );
      return false;
    }
  }, [loadSpeech, settings.engine, translator]);

  const start = useCallback(async () => {
    speaker.unlock();
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
      onError: (e) => setError({ detail: e.message }),
    });
    try {
      await engine.start({ deviceId: settings.deviceId || undefined });
      engineRef.current = engine;
      setStatus('listening');
    } catch (e) {
      engine.stop();
      setError(e.name === 'NotAllowedError' ? { code: 'errMicDenied' } : { detail: e.message || String(e) });
      setStatus('idle');
    }
  }, [prepare, settings.engine, settings.deviceId, onPartial, onFinal, speaker]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setStatus('idle');
    setLevel(0);
    // Flush whatever was still pending.
    setTimeout(() => {
      if (tracker.words.length) tracker.finalize(tracker.words.join(' '));
      if (chunker.pendingText) chunker.finalize(chunker.pendingText);
      setLive({ committed: '', pending: '' });
    }, 600);
  }, [chunker, tracker]);

  const clear = useCallback(() => {
    setLines([]);
    translator.clear();
    speaker.stop();
  }, [translator, speaker]);

  /** Type-to-test: streams typed English word by word like live speech. */
  const simulate = useCallback(
    async (text) => {
      speaker.unlock();
      if (!(await prepare({ speech: false }))) return;
      const words = text.trim().split(/\s+/).filter(Boolean);
      for (let i = 1; i <= words.length; i++) {
        onPartial(words.slice(0, i).join(' '));
        await new Promise((r) => setTimeout(r, 280));
      }
      onFinal(words.join(' '));
    },
    [prepare, onPartial, onFinal, speaker],
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
