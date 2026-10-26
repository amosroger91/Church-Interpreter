import { useEffect, useRef, useState } from 'react';
import { ENGINES, MODES, PACES, useInterpreter } from './useInterpreter.js';
import { listSpanishVoices } from './lib/speaker.js';

const DEFAULTS = {
  engine: 'vosk',
  mode: 'simul',
  liturgy: true,
  pace: 'balanced',
  speak: true,
  voiceURI: '',
  rate: 1.1,
  fontSize: 44,
  deviceId: '',
  showEnglish: true,
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('interpreter-settings') || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function useWakeLock(active) {
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

function useVoices() {
  const [voices, setVoices] = useState(listSpanishVoices);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return undefined;
    const update = () => setVoices(listSpanishVoices());
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

function useMicrophones(refreshKey) {
  const [mics, setMics] = useState([]);
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(
      (d) => setMics(d.filter((x) => x.kind === 'audioinput' && x.deviceId)),
      () => {},
    );
  }, [refreshKey]);
  return mics;
}

function ModelBadge({ label, state, progress }) {
  let text = 'not loaded';
  if (state === 'loading') {
    text = progress?.total
      ? `downloading ${Math.round((100 * progress.loaded) / progress.total)}%`
      : 'loading…';
  } else if (state === 'ready') text = 'ready ✓';
  else if (state === 'error') text = 'failed';
  return (
    <span className={`badge badge-${state}`}>
      {label}: {text}
    </span>
  );
}

function Captions({ lines, live, fontSize, showEnglish, big }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines, live]);
  const visible = big ? lines.slice(-6) : lines;
  return (
    <div className={`captions ${big ? 'captions-big' : ''}`} style={{ fontSize }} aria-live="polite">
      {visible.length === 0 && !live.pending && (
        <p className="placeholder">La interpretación en español aparecerá aquí.</p>
      )}
      {visible.map((l, i) => (
        <div key={l.id} className={`line ${i === visible.length - 1 ? 'line-current' : ''} ${l.liturgy ? 'line-liturgy' : ''}`}>
          <p className="es" lang="es">
            {l.es}
            {l.tentative && !l.done && <span className="tentative"> {l.tentative}</span>}
          </p>
          {showEnglish && !big && <p className="en" lang="en">{l.en}</p>}
        </div>
      ))}
      {showEnglish && (live.committed || live.pending) && (
        <p className="live-en" lang="en">
          <span>{live.committed}</span> <span className="pending">{live.pending}</span>
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [display, setDisplay] = useState(() => new URLSearchParams(location.search).has('display'));
  const [testText, setTestText] = useState('');
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    try {
      localStorage.setItem('interpreter-settings', JSON.stringify(settings));
    } catch {
      // storage unavailable
    }
  }, [settings]);

  const it = useInterpreter(settings);
  const voices = useVoices();
  const mics = useMicrophones(it.status);
  const listening = it.status === 'listening';
  useWakeLock(listening);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setDisplay(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openDisplay = () => {
    setDisplay(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const closeDisplay = () => {
    setDisplay(false);
    if (document.fullscreenElement) document.exitFullscreen?.();
  };

  if (display) {
    return (
      <div className="display" onDoubleClick={closeDisplay}>
        <Captions lines={it.lines} live={it.live} fontSize={settings.fontSize * 1.4} showEnglish={false} big />
        <button className="display-exit" onClick={closeDisplay} aria-label="Exit display mode">
          ✕
        </button>
        {listening && <span className="display-dot" title="Escuchando" />}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Intérprete en Vivo</h1>
          <p className="subtitle">Live English → Spanish church interpreter · works offline</p>
        </div>
        <div className="badges">
          <ModelBadge
            label="Speech"
            state={settings.engine === 'vosk' ? it.speechModel : it.speechModel === 'error' ? 'error' : 'ready'}
          />
          <ModelBadge label="Translation" state={it.translationModel.state} progress={it.translationModel} />
        </div>
      </header>

      <section className="controls">
        <button
          className={`primary ${listening ? 'stop' : ''}`}
          onClick={listening ? it.stop : it.start}
          disabled={it.status === 'loading'}
        >
          {it.status === 'loading' ? 'Loading models…' : listening ? '■ Stop' : '● Start interpreting'}
        </button>
        <div className="meter" aria-hidden>
          <div style={{ width: `${Math.round(it.level * 100)}%` }} />
        </div>
        <button
          className={`toggle ${settings.speak ? 'on' : ''}`}
          onClick={() => {
            if (!settings.speak) it.speaker.unlock();
            set({ speak: !settings.speak });
          }}
          aria-pressed={settings.speak}
          title="Read the Spanish translation out loud"
        >
          {settings.speak ? '🔊 Voice on' : '🔇 Voice off'}
        </button>
        <button onClick={openDisplay}>⛶ Display mode</button>
        <button onClick={it.clear}>Clear</button>
        <button onClick={() => it.prepare()} disabled={it.status !== 'idle'} title="Download models now so it works without internet">
          ⤓ Prepare for offline
        </button>
      </section>

      {it.error && <div className="error">{it.error}</div>}

      <Captions lines={it.lines} live={it.live} fontSize={settings.fontSize} showEnglish={settings.showEnglish} />

      <form
        className="test"
        onSubmit={(e) => {
          e.preventDefault();
          if (testText.trim()) it.simulate(testText);
          setTestText('');
        }}
      >
        <input
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Test without a microphone: type English here and press Enter"
          aria-label="Test text"
        />
        <button type="submit">Send</button>
      </form>

      <details className="settings">
        <summary>Settings</summary>
        <div className="grid">
          <label>
            Speech recognition
            <select value={settings.engine} onChange={(e) => set({ engine: e.target.value })} disabled={listening}>
              {Object.entries(ENGINES).map(([k, E]) => (
                <option key={k} value={k} disabled={E.supported === false}>
                  {E.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Microphone
            <select value={settings.deviceId} onChange={(e) => set({ deviceId: e.target.value })} disabled={listening}>
              <option value="">Default microphone</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || 'Microphone'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Translation mode
            <select value={settings.mode} onChange={(e) => set({ mode: e.target.value })} disabled={listening}>
              {Object.entries(MODES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {settings.mode !== 'fragment' && (
            <label className="check">
              <input type="checkbox" checked={settings.liturgy} onChange={(e) => set({ liturgy: e.target.checked })} />
              Use standard Spanish wording for the Lord&apos;s Prayer, Gloria, Doxology and Apostles&apos; Creed
            </label>
          )}
          <label>
            Pace
            <select value={settings.pace} onChange={(e) => set({ pace: e.target.value })}>
              {Object.entries(PACES).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.speak} onChange={(e) => set({ speak: e.target.checked })} />
            Speak Spanish aloud (use headphones or a transmitter to avoid feedback)
          </label>
          <label>
            Spanish voice
            <select value={settings.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}>
              <option value="">Automatic</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.localService ? ' · offline' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Voice speed: {settings.rate.toFixed(1)}×
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.1"
              value={settings.rate}
              onChange={(e) => set({ rate: Number(e.target.value) })}
            />
          </label>
          <label>
            Text size: {settings.fontSize}px
            <input
              type="range"
              min="20"
              max="96"
              step="2"
              value={settings.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showEnglish}
              onChange={(e) => set({ showEnglish: e.target.checked })}
            />
            Show English transcript
          </label>
        </div>
        <p className="stats">
          Last translation: {it.stats.ms} ms{it.stats.merged > 1 ? ` (caught up ${it.stats.merged} chunks)` : ''}
        </p>
      </details>

      <footer>
        Everything runs on this device — no audio leaves it with the offline engine. Speech: Vosk (WebAssembly).
        Translation: OPUS-MT English→Spanish (ONNX Runtime Web). Voice: your device's text-to-speech.
      </footer>
    </div>
  );
}
