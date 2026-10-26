import { useEffect, useRef, useState } from 'react';
import { ENGINES, MODES, PACES, useInterpreter } from './useInterpreter.js';
import { listSpanishVoices } from './lib/speaker.js';
import { LANGUAGES, defaultLanguage, translator } from './i18n.js';

const DEFAULTS = {
  uiLang: defaultLanguage(),
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

function ModelBadge({ t, label, state, progress }) {
  let text = t('notLoaded');
  if (state === 'loading') {
    text = progress?.total
      ? t('downloading', { pct: Math.round((100 * progress.loaded) / progress.total) })
      : t('loading');
  } else if (state === 'ready') text = t('ready');
  else if (state === 'error') text = t('failed');
  return (
    <span className={`badge badge-${state}`}>
      {label}: {text}
    </span>
  );
}

function Captions({ t, lines, live, fontSize, showEnglish, big }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines, live]);
  const visible = big ? lines.slice(-6) : lines;
  return (
    <div className={`captions ${big ? 'captions-big' : ''}`} style={{ fontSize }} aria-live="polite">
      {visible.length === 0 && !live.pending && (
        <p className="placeholder">{t('placeholder')}</p>
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
  const t = translator(settings.uiLang);

  useEffect(() => {
    document.documentElement.lang = settings.uiLang;
  }, [settings.uiLang]);
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
        <Captions t={t} lines={it.lines} live={it.live} fontSize={settings.fontSize * 1.4} showEnglish={false} big />
        <button className="display-exit" onClick={closeDisplay} aria-label={t('exitDisplay')}>
          ✕
        </button>
        {listening && <span className="display-dot" title={t('listening')} />}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Intérprete en Vivo</h1>
          <p className="subtitle">{t('subtitle')}</p>
        </div>
        <div className="badges">
          <div className="lang-switch" role="group" aria-label={t('language')}>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <button
                key={code}
                className={settings.uiLang === code ? 'active' : ''}
                aria-pressed={settings.uiLang === code}
                onClick={() => set({ uiLang: code })}
                lang={code}
              >
                {name}
              </button>
            ))}
          </div>
          <ModelBadge
            t={t}
            label={t('speech')}
            state={settings.engine === 'vosk' ? it.speechModel : it.speechModel === 'error' ? 'error' : 'ready'}
          />
          <ModelBadge t={t} label={t('translation')} state={it.translationModel.state} progress={it.translationModel} />
        </div>
      </header>

      <section className="controls">
        <button
          className={`primary ${listening ? 'stop' : ''}`}
          onClick={listening ? it.stop : it.start}
          disabled={it.status === 'loading'}
        >
          {it.status === 'loading' ? t('loadingModels') : listening ? t('stop') : t('start')}
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
          title={t('voiceTitle')}
        >
          {settings.speak ? t('voiceOn') : t('voiceOff')}
        </button>
        <button onClick={openDisplay}>{t('displayMode')}</button>
        <button onClick={it.clear}>{t('clear')}</button>
        <button onClick={() => it.prepare()} disabled={it.status !== 'idle'} title={t('prepareTitle')}>
          {t('prepare')}
        </button>
      </section>

      {it.error && (
        <div className="error">
          {[it.error.code && t(it.error.code), it.error.detail].filter(Boolean).join(' — ')}
        </div>
      )}

      <Captions t={t} lines={it.lines} live={it.live} fontSize={settings.fontSize} showEnglish={settings.showEnglish} />

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
          placeholder={t('testPlaceholder')}
          aria-label={t('testLabel')}
        />
        <button type="submit">{t('send')}</button>
      </form>

      <details className="settings">
        <summary>{t('settings')}</summary>
        <div className="grid">
          <label>
            {t('engine')}
            <select value={settings.engine} onChange={(e) => set({ engine: e.target.value })} disabled={listening}>
              {Object.entries(ENGINES).map(([k, E]) => (
                <option key={k} value={k} disabled={E.supported === false}>
                  {t('engine' + k[0].toUpperCase() + k.slice(1))}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('microphone')}
            <select value={settings.deviceId} onChange={(e) => set({ deviceId: e.target.value })} disabled={listening}>
              <option value="">{t('defaultMic')}</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || t('mic')}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('mode')}
            <select value={settings.mode} onChange={(e) => set({ mode: e.target.value })} disabled={listening}>
              {Object.keys(MODES).map((k) => (
                <option key={k} value={k}>
                  {t('mode' + k[0].toUpperCase() + k.slice(1))}
                </option>
              ))}
            </select>
          </label>
          {settings.mode !== 'fragment' && (
            <label className="check">
              <input type="checkbox" checked={settings.liturgy} onChange={(e) => set({ liturgy: e.target.checked })} />
              {t('liturgy')}
            </label>
          )}
          <label>
            {t('pace')}
            <select value={settings.pace} onChange={(e) => set({ pace: e.target.value })}>
              {Object.keys(PACES).map((k) => (
                <option key={k} value={k}>
                  {t('pace' + k[0].toUpperCase() + k.slice(1))}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.speak} onChange={(e) => set({ speak: e.target.checked })} />
            {t('speakAloud')}
          </label>
          <label>
            {t('voice')}
            <select value={settings.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}>
              <option value="">{t('automatic')}</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.localService ? t('offlineVoice') : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('voiceSpeed', { rate: settings.rate.toFixed(1) })}
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
            {t('textSize', { size: settings.fontSize })}
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
            {t('showEnglish')}
          </label>
        </div>
        <p className="stats">
          {t('lastTranslation', { ms: it.stats.ms })}
          {it.stats.merged > 1 ? t('caughtUp', { n: it.stats.merged }) : ''}
        </p>
      </details>

      <footer>{t('footer')}</footer>
    </div>
  );
}
