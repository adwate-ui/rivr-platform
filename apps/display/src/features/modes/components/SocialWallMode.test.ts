import { describe, expect, it } from 'vitest';
import { wallSlide } from './SocialWallMode.tsx';

describe('the social wall (decision 0267)', () => {
  it('shows a post as its poster’s handle over the caption, with its place in the turn', () => {
    expect(wallSlide({ handle: 'zoya.plays', caption: 'Final table at RIVR' }, 2, 6)).toEqual({
      label: 'On Instagram', title: '@zoya.plays', detail: 'Final table at RIVR', pager: { current: 2, count: 6, label: 'Post 2 of 6' },
    });
    expect(wallSlide({ handle: 'kabir.s', caption: '' }, 1, 1).detail).toBeUndefined();
  });
});
