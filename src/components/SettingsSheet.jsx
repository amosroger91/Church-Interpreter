import { useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';
import { ENGINES, MODES, PACES } from '../useInterpreter.js';
import { RVR1960_NOTICE } from '../lib/verses.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

/** Slide-in panel with all settings, grouped. */
export function SettingsSheet({ open, onClose, t, it, settings, set, voices, mics, listening }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`sheet-layer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        tabIndex={-1}
        ref={panelRef}
        inert={open ? undefined : ''}
      >
        <header className="sheet-header">
          <h2>{t('settings')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" />
          </button>
        </header>

        <section className="sheet-section">
          <h3>{t('secAudio')}</h3>
          <Field label={t('engine')} hint={t('engineHint')}>
            <select value={settings.engine} onChange={(e) => set({ engine: e.target.value })} disabled={listening}>
              {Object.entries(ENGINES).map(([k, E]) => (
                <option key={k} value={k} disabled={E.supported === false}>
                  {t('engine' + cap(k))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('microphone')} hint={t('micHint')}>
            <select value={settings.deviceId} onChange={(e) => set({ deviceId: e.target.value })} disabled={listening}>
              <option value="">{t('defaultMic')}</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || t('mic')}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="sheet-section">
          <h3>{t('secTranslation')}</h3>
          <Field label={t('pace')} hint={t('paceHint')}>
            <div className="segmented">
              {Object.keys(PACES).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={settings.pace === k ? 'is-active' : ''}
                  aria-pressed={settings.pace === k}
                  onClick={() => set({ pace: k })}
                >
                  {t('pace' + cap(k))}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('mode')}>
            <select value={settings.mode} onChange={(e) => set({ mode: e.target.value })} disabled={listening}>
              {Object.keys(MODES).map((k) => (
                <option key={k} value={k}>
                  {t('mode' + cap(k))}
                </option>
              ))}
            </select>
          </Field>
          {settings.mode !== 'fragment' && (
            <Toggle checked={settings.liturgy} onChange={(v) => set({ liturgy: v })} label={t('liturgyShort')} hint={t('liturgy')} />
          )}
        </section>

        <section className="sheet-section">
          <h3>{t('secVoice')}</h3>
          <Toggle checked={settings.speak} onChange={(v) => { if (v) it.speaker.unlock(); set({ speak: v }); }} label={t('speakShort')} hint={t('speakAloud')} />
          <Field label={t(it.to === 'es' ? 'voiceEs' : 'voiceEn')}>
            <select
              value={settings.voices?.[it.to] || ''}
              onChange={(e) => set({ voices: { ...settings.voices, [it.to]: e.target.value } })}
            >
              <option value="">{t('automatic')}</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.localService ? t('offlineVoice') : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('voiceSpeed', { rate: settings.rate.toFixed(1) })}>
            <input type="range" min="0.7" max="1.8" step="0.1" value={settings.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
          </Field>
        </section>

        <section className="sheet-section">
          <h3>{t('secDisplay')}</h3>
          <Field label={t('textSize', { size: settings.fontSize })}>
            <input type="range" min="20" max="96" step="2" value={settings.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </Field>
          <Toggle checked={settings.showSource} onChange={(v) => set({ showSource: v })} label={t('showSource')} />
        </section>

        <section className="sheet-section sheet-about">
          <p>
            {t('lastTranslation', { ms: it.stats.ms })}
            {it.stats.merged > 1 ? t('caughtUp', { n: it.stats.merged }) : ''}
          </p>
          <p>{t('footer')}</p>
          <p>{t('verseCredit')} {RVR1960_NOTICE}</p>
          <p>
            {t('version')} {__APP_VERSION__}
          </p>
        </section>
      </aside>
    </div>
  );
}
