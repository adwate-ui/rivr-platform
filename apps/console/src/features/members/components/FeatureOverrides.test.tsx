import { describe, expect, it } from 'vitest';
import { liveFeatures } from './FeatureOverrides.tsx';

describe('liveFeatures (audit F-086)', () => {
  it('offers what the club runs and none of what it hid or dropped', () => {
    const features = [{ key: 'waitlist.join' }, { key: 'rewards.rakeback' }, { key: 'cab.requests' }, { key: 'sessions.history' }];
    expect(liveFeatures(features).map((feature) => feature.key)).toEqual(['waitlist.join', 'sessions.history']);
  });
});
