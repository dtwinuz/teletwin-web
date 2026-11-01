import { describe, expect, it } from 'vitest';

import { getTeleTwinLocale, getTeleTwinString, TELETWIN_STRING_TABLES } from './strings';

import fallback from '../assets/localization/fallback.strings?raw';

const RE_KEY_VALUE = /^"(TeleTwin[^"]+)" = "(.*)";$/gm;
const RE_VARIABLE = /\{[a-z]+\}/g;

const uzbek = Object.fromEntries([...fallback.matchAll(RE_KEY_VALUE)].map(([, key, value]) => [key, value]));
const uzbekKeys = Object.keys(uzbek).sort();

describe('TeleTwin strings', () => {
  it('reads the Uzbek keys from fallback.strings', () => {
    expect(uzbekKeys.length).toBeGreaterThan(80);
  });

  it.each(Object.entries(TELETWIN_STRING_TABLES))('%s table has exactly the Uzbek keys', (_, table) => {
    expect(Object.keys(table).sort()).toEqual(uzbekKeys);
  });

  it.each(Object.entries(TELETWIN_STRING_TABLES))('%s table keeps every {variable}', (_, table) => {
    uzbekKeys.forEach((key) => {
      const expected = (uzbek[key].match(RE_VARIABLE) || []).sort();
      expect([key, (table[key].match(RE_VARIABLE) || []).sort()]).toEqual([key, expected]);
    });
  });

  it.each([
    [undefined, 'uz'],
    ['uz', 'uz'],
    ['uz-beta', 'uz'],
    ['ru', 'ru'],
    ['uk', 'ru'],
    ['kk', 'ru'],
    ['en', 'en'],
    ['de', 'en'],
    ['pt-br', 'en'],
  ])('maps interface language %s to %s', (langCode, locale) => {
    expect(getTeleTwinLocale(langCode)).toBe(locale);
  });

  it('leaves Uzbek and non-TeleTwin keys to the language pack', () => {
    expect(getTeleTwinString('TeleTwinSignIn', 'uz')).toBeUndefined();
    expect(getTeleTwinString('Settings', 'ru')).toBeUndefined();
    expect(getTeleTwinString('TeleTwinSignIn', 'ru')).toBe('Войти');
    expect(getTeleTwinString('TeleTwinSignIn', 'en')).toBe('Sign in');
  });
});
