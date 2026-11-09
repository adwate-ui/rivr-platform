import { describe, expect, it } from 'vitest';
import { liveFeatures } from './FeatureOverrides.tsx';

describe('liveFeatures (audit F-086)', () => {
  it('offers what the club runs and none of what it hid or dropped', () => {
    const features = [{ key: 'waitlist.join' }, { key: 'balance.deposits' }, { key: 'rewards.rakeback' }, { key: 'rewards.accommodation' }, { key: 'social.winner_cards' }, { key: 'academy.booking' }, { key: 'learn.drills' }, { key: 'cab.requests' }, { key: 'rewards.catalogue' }];
    expect(liveFeatures(features).map((feature) => feature.key)).toEqual(['waitlist.join', 'rewards.catalogue']);
  });
});
