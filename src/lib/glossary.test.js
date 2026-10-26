import { describe, it, expect } from 'vitest';
import { applyGlossary, restoreGlossary, placeholderName, isPlaceholder, TERMS } from './glossary.js';

// Stand-in for the translation model: placeholders pass through unchanged.
const ph = (en) => placeholderName(TERMS.findIndex((t) => t.en.includes(en)));

describe('glossary (English -> Spanish)', () => {
  it('swaps church terms for placeholders, longest phrase first', () => {
    const out = applyGlossary("let's thank the praise and worship team", 'en-es');
    expect(out).toBe(`let's thank the ${ph('praise team')}`);
  });

  it('rewrites Southern expressions into plain English', () => {
    expect(applyGlossary("y'all are fixin' to hear the word", 'en-es')).toBe('you all are about to hear the word');
    expect(applyGlossary('can i get an amen', 'en-es')).toBe('somebody say amen');
    expect(applyGlossary('if you want to get saved come forward', 'en-es')).toBe('if you want to accept Christ come to the front');
  });

  it('only treats "service" as a church service after a determiner', () => {
    expect(applyGlossary('after the service', 'en-es')).toBe(`after the ${ph('worship service')}`);
    expect(applyGlossary('a life of service to others', 'en-es')).toBe('a life of service to others');
  });

  it('restores terms with articles that agree in gender and number', () => {
    const conjunto = ph('praise team');
    const campaña = ph('revival services');
    expect(restoreGlossary(`Agradezcamos al ${conjunto} por guiarnos.`, 'en-es')).toBe('Agradezcamos al conjunto por guiarnos.');
    expect(restoreGlossary(`Tendremos un ${campaña} y todos irán al ${campaña}.`, 'en-es')).toBe(
      'Tendremos una campaña de avivamiento y todos irán a la campaña de avivamiento.',
    );
    // Bare at the start of a sentence, or after a "personal a", it gets an article.
    expect(restoreGlossary(`${campaña} empieza el lunes.`, 'en-es')).toBe('La campaña de avivamiento empieza el lunes.');
    expect(restoreGlossary(`Vamos a tener a ${campaña}.`, 'en-es')).toBe('Vamos a tener a la campaña de avivamiento.');
  });

  it('finds placeholders even if the model changes their ending', () => {
    const conjunto = ph('praise team');
    expect(restoreGlossary(`Gracias al ${conjunto.slice(0, -1)}do.`, 'en-es')).toBe('Gracias al conjunto.');
  });

  it('uses evangelical and Latin American wording', () => {
    expect(restoreGlossary('Los hermanos rezarán con vosotros. Recemos.', 'en-es')).toBe('Los hermanos orarán con ustedes. Oremos.');
    expect(restoreGlossary('Un rezo sencillo', 'en-es')).toBe('Un rezo sencillo');
  });

  it('fixes common model slips', () => {
    expect(restoreGlossary('¿Puedo conseguir un amén?', 'en-es')).toBe('¿Quién dice amén?');
    expect(restoreGlossary('Si necesitas oración, ven al frente.', 'en-es')).toBe('Si necesitas oración, pasa al frente.');
  });
});

describe('Bible books', () => {
  it('uses the Spanish book name without an article', () => {
    const src = applyGlossary('open your bible with me to first corinthians chapter thirteen', 'en-es');
    const book = src.split(' ').find(isPlaceholder);
    expect(restoreGlossary(`Abre tu Biblia conmigo a los ${book} capítulo trece`, 'en-es')).toBe(
      'Abre tu Biblia conmigo a Primera de Corintios capítulo trece',
    );
  });
  it('only treats ambiguous names as books before a chapter number', () => {
    expect(applyGlossary('mark my words', 'en-es')).toBe('mark my words');
    expect(applyGlossary('mark chapter four', 'en-es')).not.toContain('mark');
  });
});

describe('glossary (Spanish -> English)', () => {
  it('recognizes Spanish church terms, ignoring accents', () => {
    const out = applyGlossary('gracias al conjunto y a los ujieres por el culto de oracion', 'es-en');
    expect(out).toBe(`gracias al ${ph('praise team')} y a los ${ph('ushers')} por el ${ph('prayer meeting')}`);
  });

  it('leaves ordinary uses alone', () => {
    expect(applyGlossary('trabajamos en conjunto', 'es-en')).toBe('trabajamos en conjunto');
  });

  it('restores English terms and fixes a/an', () => {
    expect(restoreGlossary(`We thank the ${ph('praise team')} and a ${ph('usher')}.`, 'es-en')).toBe(
      'We thank the praise team and an usher.',
    );
    expect(restoreGlossary('Join us for the cult on Sunday. Who says amen?', 'es-en')).toBe(
      'Join us for the service on Sunday. Can I get an amen?',
    );
  });
});
