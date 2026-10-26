// Small text helpers that make raw speech-recognizer output (lowercase, no
// punctuation) translate better, and tidy fragment translations.

// Words that should be capitalized so the translator treats them as the
// proper nouns they are in a church setting ("god" -> "God" -> "Dios").
const PROPER_NOUNS = [
  'holy spirit', 'holy ghost', 'jesus christ', 'son of god', 'son of man',
  'god', 'jesus', 'christ', 'lord', 'savior', 'saviour', 'messiah',
  'bible',
  'israel', 'jerusalem', 'bethlehem', 'nazareth', 'galilee', 'egypt',
  'mary', 'joseph', 'peter', 'paul', 'john', 'james', 'moses', 'abraham',
  'isaac', 'jacob', 'david', 'solomon', 'noah', 'adam', 'elijah',
  'genesis', 'exodus', 'leviticus', 'deuteronomy', 'psalm', 'psalms',
  'proverbs', 'isaiah', 'jeremiah', 'ezekiel', 'daniel', 'matthew', 'luke',
  'romans', 'corinthians', 'galatians', 'ephesians',
  'philippians', 'colossians', 'hebrews', 'revelation', 'easter',
  'christmas', 'pentecost', 'i',
];

const PROPER_RE = new RegExp(
  `\\b(${PROPER_NOUNS.map((p) => p.replace(/ /g, '\\s+')).join('|')})\\b`,
  'gi',
);

function titleCase(s) {
  return s.replace(/\p{L}+/gu, (w) =>
    w.toLowerCase() === 'of' ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

/** Prepare an English chunk for the translator. */
export function prepareEnglish(text, { start = false } = {}) {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  t = t.replace(PROPER_RE, (m) => titleCase(m));
  // Fix contractions the recognizer splits apart ("i 'm" -> "I'm").
  t = t.replace(/\s+'(s|m|re|ve|ll|d|t)\b/gi, "'$1");
  if (start) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

// Spanish words that are capitalized in church usage, matched with or
// without accents (speech recognizers are inconsistent about them).
const ES_PROPER = [
  'espíritu santo', 'jesucristo', 'jesús', 'cristo', 'dios', 'biblia', 'mesías',
  'israel', 'jerusalén', 'belén', 'nazaret', 'galilea', 'egipto',
  'maría', 'josé', 'pedro', 'pablo', 'moisés', 'abraham', 'isaac', 'jacob', 'david',
  'salomón', 'noé', 'adán', 'elías',
  'génesis', 'éxodo', 'levítico', 'deuteronomio', 'salmos', 'salmo', 'proverbios',
  'isaías', 'jeremías', 'ezequiel', 'mateo', 'marcos', 'lucas', 'romanos',
  'corintios', 'gálatas', 'efesios', 'filipenses', 'colosenses', 'hebreos',
  'apocalipsis', 'pascua', 'navidad', 'pentecostés',
];
const stripAccents = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ES_PROPER_MAP = new Map(ES_PROPER.map((w) => [stripAccents(w), w]));
const ES_PROPER_RE = new RegExp(
  `(^|[^\\p{L}])(${[...ES_PROPER_MAP.keys()].sort((a, b) => b.length - a.length).map((w) => w.replace(/[aeiou]/g, (c) => `[${c}${'áéíóú'['aeiou'.indexOf(c)]}]`).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`,
  'giu',
);

/** Prepare a Spanish chunk for the translator (capitalization, accents). */
export function prepareSpanish(text, { start = false } = {}) {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  t = t.replace(ES_PROPER_RE, (m, pre, w) => {
    const canonical = ES_PROPER_MAP.get(stripAccents(w.toLowerCase()).replace(/\s+/g, ' ')) || w;
    return pre + canonical.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  });
  // "el señor" in church speech is the Lord.
  t = t.replace(/\b(el|al|del|nuestro|oh|mi)\s+señor\b/giu, (m, d) => `${d} Señor`);
  if (start) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

/**
 * Tidy a translated fragment. Fragment translators tend to add a final
 * period to everything; drop it unless the speaker actually finished.
 */
export function tidyTarget(text, { final = false } = {}) {
  let t = (text || '').trim().replace(/\s+/g, ' ');
  if (!final) t = t.replace(/[.。]+$/, '');
  return t;
}

/** @deprecated use tidyTarget */
export const tidySpanish = tidyTarget;
