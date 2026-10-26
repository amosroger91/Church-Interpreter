import { useEffect, useRef } from 'react';
import { verseOfTheDay } from '../lib/verses.js';

/** The verse of the day, in the interface language. */
export function Verse({ lang, className = '' }) {
  const v = verseOfTheDay();
  return (
    <figure className={`verse ${className}`} lang={lang}>
      <blockquote>{v[lang]}</blockquote>
      <figcaption>{v.ref[lang]}</figcaption>
    </figure>
  );
}

/** Shown before anything has been said. */
function Welcome({ t, fromName, toName }) {
  return (
    <div className="welcome">
      <p className="welcome-route">
        {fromName} <span aria-hidden="true">→</span> {toName}
      </p>
      <h2>{t('welcomeTitle')}</h2>
      <ol>
        <li>{t('welcomeStep1')}</li>
        <li>{t('welcomeStep2')}</li>
        <li>{t('welcomeStep3')}</li>
      </ol>
    </div>
  );
}

export function Captions({ t, lines, live, fontSize, showSource, sourceLang, fromName, toName }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [lines, live]);
  const empty = lines.length === 0 && !live.pending && !live.committed;
  return (
    <section className={`captions ${empty ? 'is-empty' : ''}`} style={{ '--caption-size': `${fontSize}px` }} aria-live="polite">
      {empty && <Welcome t={t} fromName={fromName} toName={toName} />}
      {lines.map((l, i) => (
        <article
          key={l.id}
          className={`line ${i === lines.length - 1 ? 'is-current' : ''} ${l.liturgy ? 'is-liturgy' : ''}`}
        >
          {l.liturgy && <span className="liturgy-tag">{l.src}</span>}
          <p className="out" lang={l.lang}>
            {l.out}
            {l.tentative && !l.done && <span className="tentative"> {l.tentative}</span>}
          </p>
          {showSource && !l.liturgy && l.src && (
            <p className="src" lang={sourceLang}>
              {l.src}
            </p>
          )}
        </article>
      ))}
      {showSource && (live.committed || live.pending) && (
        <p className="live-src" lang={sourceLang}>
          <span>{live.committed}</span> <span className="pending">{live.pending}</span>
        </p>
      )}
      <div ref={endRef} />
    </section>
  );
}

/** Full-screen captions for a projector or TV. */
export function DisplayCaptions({ t, lines, fontSize, listening, uiLang, onExit }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);
  const visible = lines.slice(-5);
  return (
    <div className="display" onDoubleClick={onExit}>
      <div className="display-captions" style={{ '--caption-size': `${Math.round(fontSize * 1.4)}px` }} aria-live="polite">
        {visible.length === 0 ? (
          <Verse lang={uiLang} className="verse-display" />
        ) : (
          visible.map((l, i) => (
            <p key={l.id} className={`out ${i === visible.length - 1 ? 'is-current' : ''}`} lang={l.lang}>
              {l.out}
              {l.tentative && !l.done && <span className="tentative"> {l.tentative}</span>}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
      {listening && <span className="display-live" title={t('listening')} />}
      <button className="display-exit" onClick={onExit} aria-label={t('exitDisplay')}>
        ✕
      </button>
    </div>
  );
}
