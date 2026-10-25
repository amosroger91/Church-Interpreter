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

/**
 * Tidy a translated fragment. Fragment translators tend to add a final
 * period to everything; drop it unless the speaker actually finished.
 */
export function tidySpanish(text, { final = false } = {}) {
  let t = (text || '').trim().replace(/\s+/g, ' ');
  if (!final) t = t.replace(/[.。]+$/, '');
  return t;
}
