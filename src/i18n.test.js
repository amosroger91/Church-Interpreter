import { describe, it, expect } from 'vitest';
import { STRINGS, translator } from './i18n.js';

describe('i18n', () => {
  it('has every string in both English and Spanish', () => {
    expect(Object.keys(STRINGS.es).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('fills in values', () => {
    expect(translator('es')('downloading', { pct: 42 })).toBe('descargando 42%');
    expect(translator('en')('voiceSpeed', { rate: '1.1' })).toBe('Voice speed: 1.1×');
  });
});
