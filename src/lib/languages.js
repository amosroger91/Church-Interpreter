// Per-direction settings: which models, text clean-up, and glossary.
import { applyGlossary, restoreGlossary } from './glossary.js';
import { prepareEnglish, prepareSpanish, tidyTarget } from './text.js';

export const DIRECTIONS = {
  'en-es': {
    from: 'en',
    to: 'es',
    translationModel: 'Xenova/opus-mt-en-es',
    // Articles in the output whose form depends on the noun that follows.
    holdWords: ['el', 'la', 'los', 'las', 'al', 'del', 'un', 'una', 'unos', 'unas', 'a', 'de',
      // Fixed up afterwards ("ven al frente" -> "pasa al frente").
      'ven', 'venga', 'vengan', 'acércate', 'acérquense'],
  },
  'es-en': {
    from: 'es',
    to: 'en',
    translationModel: 'Xenova/opus-mt-es-en',
    holdWords: ['a', 'an', 'the',
      // Fixed up afterwards ("go to the front" -> "come forward").
      'go', 'pass', 'come', 'move'],
  },
};

/** Prepare recognized speech for the translation model. */
export function prepareSource(text, direction, { start = false } = {}) {
  // Glossary first, so rewritten phrases get capitalized too.
  const t = applyGlossary(text, direction);
  return DIRECTIONS[direction].from === 'es' ? prepareSpanish(t, { start }) : prepareEnglish(t, { start });
}

/** Turn raw model output into the text shown and spoken. */
export function finishTarget(text, direction) {
  return restoreGlossary(text, direction);
}

export { tidyTarget };
