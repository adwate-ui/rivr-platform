import { describe, expect, it } from 'vitest';
import { HIDDEN, toFeatureAccess, toFeatureAccessMap } from './featureAccess.ts';

describe('toFeatureAccess', () => {
  it('passes an enabled feature through', () => {
    expect(toFeatureAccess({ feature_key: 'learn.library', state: 'enabled', tiers: [] })).toEqual({ state: 'enabled' });
  });

  it('keeps the tiers that have a locked feature, for the notice', () => {
    expect(toFeatureAccess({ feature_key: 'learn.library', state: 'locked', tiers: ['Black card'] }))
      .toEqual({ state: 'locked', tiers: ['Black card'] });
  });

  it('treats a locked row without tiers as locked with none named', () => {
    expect(toFeatureAccess({ feature_key: 'learn.library', state: 'locked', tiers: null })).toEqual({ state: 'locked', tiers: [] });
  });

  it('hides anything it does not recognise, the safe reading', () => {
    expect(toFeatureAccess({ feature_key: 'learn.library', state: 'surprise', tiers: [] })).toBe(HIDDEN);
    expect(toFeatureAccess({ feature_key: 'learn.library', state: 'hidden', tiers: [] })).toBe(HIDDEN);
  });
});

describe('toFeatureAccessMap', () => {
  it('indexes access by feature key', () => {
    const access = toFeatureAccessMap([
      { feature_key: 'learn.library', state: 'enabled', tiers: [] },
      { feature_key: 'cab.requests', state: 'hidden', tiers: [] },
    ]);
    expect(access.get('learn.library')).toEqual({ state: 'enabled' });
    expect(access.get('cab.requests')).toBe(HIDDEN);
    expect(access.get('league.standings')).toBeUndefined();
  });
});
