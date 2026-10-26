import { useEffect, useState } from 'react';
import { useInterpreter } from './useInterpreter.js';
import { LANGUAGES, translator } from './i18n.js';
import { useMicrophones, useSettings, useVoices, useWakeLock } from './hooks.js';
import { Icon } from './components/Icons.jsx';
import { Captions, DisplayCaptions, Verse } from './components/Captions.jsx';
import { SettingsSheet } from './components/SettingsSheet.jsx';
import { installUpdate, onUpdateReady } from './lib/pwa.js';

const LANG_NAME = { en: 'English', es: 'Español' };

/** One combined indicator for both models (speech + translation). */
function Status({ t, it, engine, onRetry }) {
  const speech = engine === 'vosk' ? it.speechModel : it.speechModel === 'error' ? 'error' : 'ready';
  const tr = it.translationModel;
  let state = 'ready';
  let text = t('statusReady');
  let pct = null;
  if (speech === 'error' || tr.state === 'error') {
    state = 'error';
    text = t('statusError');
  } else if (it.status === 'listening') {
    state = 'live';
    text = t('listening');
  } else if (speech !== 'ready' || tr.state !== 'ready') {
    state = 'loading';
    pct = tr.total ? Math.round((100 * tr.loaded) / tr.total) : null;
    text = pct != null && pct < 100 ? t('statusDownloading', { pct }) : t('statusPreparing');
  }
  return (
    <div className={`status status-${state}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{text}</span>
      {state === 'error' && (
        <button className="status-retry" onClick={onRetry} disabled={it.status !== 'idle'}>
          <Icon name="refresh" size={16} /> {t('retryDownload')}
        </button>
      )}
      {state === 'loading' && pct != null && (
        <span className="status-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [settings, set] = useSettings();
  const [display, setDisplay] = useState(() => new URLSearchParams(location.search).has('display'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [testText, setTestText] = useState('');

  const it = useInterpreter(settings);
  const t = translator(settings.uiLang);
  const voices = useVoices(it.to);
  const mics = useMicrophones(it.status);
  const listening = it.status === 'listening';
  const busy = it.status === 'loading';
  useWakeLock(listening);

  useEffect(() => {
    document.documentElement.lang = settings.uiLang;
  }, [settings.uiLang]);

  // Download the models as soon as the page opens (and again when the
  // direction changes or the connection comes back), so the interpreter is
  // ready, and cached for offline use, before anyone presses Start.
  const { prepare } = it;
  useEffect(() => {
    prepare();
    const onOnline = () => prepare();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [prepare]);

  // Ask the browser not to evict the ~120 MB of cached models.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // A new version of the app was downloaded: switch to it now, or as soon as
  // interpreting stops (reloading would cut off the microphone).
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => onUpdateReady(() => setUpdateReady(true)), []);
  useEffect(() => {
    if (updateReady && it.status === 'idle') installUpdate();
  }, [updateReady, it.status]);

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
      <DisplayCaptions
        t={t}
        lines={it.lines}
        fontSize={settings.fontSize}
        listening={listening}
        uiLang={settings.uiLang}
        onExit={closeDisplay}
      />
    );
  }

  const swapDirection = () => set({ direction: it.direction === 'en-es' ? 'es-en' : 'en-es' });
  const level = Math.round(it.level * 100);

  return (
    <div className={`app ${listening ? 'is-listening' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <img src="icon.svg" alt="" width="34" height="34" />
          <div>
            <h1>Intérprete en Vivo</h1>
            <p className="tagline">{t('tagline')}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="lang-switch" role="group" aria-label={t('language')}>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <button
                key={code}
                className={settings.uiLang === code ? 'is-active' : ''}
                aria-pressed={settings.uiLang === code}
                onClick={() => set({ uiLang: code, uiLangChosen: true })}
                lang={code}
              >
                {name.slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={t('settings')} title={t('settings')}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="stage-head">
          <div className="route" role="group" aria-label={t('direction')}>
            <span className="route-lang" lang={it.from}>
              <small>{t('speaking')}</small>
              {LANG_NAME[it.from]}
            </span>
            <button
              className="route-swap"
              onClick={swapDirection}
              disabled={listening || busy}
              aria-label={t('swapDirection')}
              title={t('swapDirection')}
            >
              <Icon name="swap" />
            </button>
            <span className="route-lang" lang={it.to}>
              <small>{t('interpreting')}</small>
              {LANG_NAME[it.to]}
            </span>
          </div>
          <Status t={t} it={it} engine={settings.engine} onRetry={() => it.prepare()} />
        </div>

        {it.error && (
          <div className="alert" role="alert">
            {[it.error.code && t(it.error.code), it.error.detail].filter(Boolean).join(' — ')}
          </div>
        )}

        <div className="caption-card">
          <div className="caption-tools">
            <button className="chip-button" onClick={openDisplay} title={t('displayModeHint')}>
              <Icon name="screen" size={18} /> {t('displayMode')}
            </button>
            {it.lines.length > 0 && (
              <button className="chip-button" onClick={it.clear}>
                <Icon name="trash" size={18} /> {t('clear')}
              </button>
            )}
          </div>
          <Captions
            t={t}
            lines={it.lines}
            live={it.live}
            fontSize={settings.fontSize}
            showSource={settings.showSource}
            sourceLang={it.from}
            fromName={LANG_NAME[it.from]}
            toName={LANG_NAME[it.to]}
          />
        </div>

        <Verse lang={settings.uiLang} />
      </main>

      <footer className="dock">
        {typing && (
          <form
            className="type-bar"
            onSubmit={(e) => {
              e.preventDefault();
              if (testText.trim()) it.simulate(testText);
              setTestText('');
            }}
          >
            <input
              autoFocus
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder={t(it.from === 'en' ? 'testPlaceholder' : 'testPlaceholderEs')}
              aria-label={t('testLabel')}
              lang={it.from}
            />
            <button type="submit" className="icon-button" aria-label={t('send')}>
              <Icon name="send" />
            </button>
          </form>
        )}
        <div className="dock-row">
          <button
            className={`dock-button ${settings.speak ? 'is-on' : ''}`}
            onClick={() => {
              if (!settings.speak) it.speaker.unlock();
              set({ speak: !settings.speak });
            }}
            aria-pressed={settings.speak}
            title={t('voiceTitle')}
          >
            <Icon name={settings.speak ? 'volume' : 'mute'} />
            <span>{settings.speak ? t('voiceOnShort') : t('voiceOffShort')}</span>
          </button>

          <button
            className={`mic ${listening ? 'is-live' : ''}`}
            onClick={listening ? it.stop : it.start}
            disabled={busy}
            aria-label={listening ? t('stop') : t('start')}
            style={{ '--level': level / 100 }}
          >
            <span className="mic-ring" aria-hidden="true" />
            <Icon name={listening ? 'stop' : 'mic'} size={34} />
          </button>

          <button
            className={`dock-button ${typing ? 'is-on' : ''}`}
            onClick={() => setTyping((v) => !v)}
            aria-pressed={typing}
            title={t('typeToTestHint')}
          >
            <Icon name="keyboard" />
            <span>{t('typeToTest')}</span>
          </button>
        </div>
        <p className="dock-hint" aria-live="polite">
          {busy ? t('loadingModels') : listening ? t('tapToStop') : t('tapToStart')}
        </p>
      </footer>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        t={t}
        it={it}
        settings={settings}
        set={set}
        voices={voices}
        mics={mics}
        listening={listening}
      />
    </div>
  );
}
