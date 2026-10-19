import { describe, expect, it } from 'vitest';
import { consoleApp, playerApp } from './catalogue/en/apps.ts';
import { registerMessages, t } from './translate.ts';

describe('t', () => {
  it('returns the message for the key', () => {
    expect(t('common.retry')).toBe('Try again');
  });

  it('reads an app\'s copy once the app registers it, and only that app\'s', () => {
    expect(t('player.tonight.title')).toBe('player.tonight.title');
    registerMessages({ player: playerApp });
    expect(t('player.tonight.title')).toBe(playerApp.tonight.title);
    expect(t('console.cage.title')).toBe('console.cage.title');
    registerMessages({ console: consoleApp });
    expect(t('console.cage.title')).toBe(consoleApp.cage.title);
  });

  it('fills placeholders from params', () => {
    expect(t('common.featureLocked', { tiers: 'Black card' })).toBe('Black card only.');
  });

  it('leaves a placeholder visible when its value is missing, so the gap is noticed', () => {
    expect(t('common.featureLocked')).toBe('{tiers} only.');
  });
});
