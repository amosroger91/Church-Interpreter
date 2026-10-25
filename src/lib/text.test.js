import { describe, it, expect } from 'vitest';
import { prepareEnglish, tidySpanish } from './text.js';

describe('prepareEnglish', () => {
  it('capitalizes church proper nouns and the sentence start', () => {
    expect(prepareEnglish('the holy spirit and the son of god', { start: true })).toBe(
      'The Holy Spirit and the Son of God',
    );
    expect(prepareEnglish("i 'm reading from romans")).toBe("I'm reading from Romans");
  });
  it('leaves ordinary words alone', () => {
    expect(prepareEnglish('the godly man')).toBe('the godly man');
  });
});

describe('tidySpanish', () => {
  it('drops the period the translator adds to unfinished fragments', () => {
    expect(tidySpanish('Porque Dios amó tanto al mundo.')).toBe('Porque Dios amó tanto al mundo');
    expect(tidySpanish('Amén.', { final: true })).toBe('Amén.');
  });
});
