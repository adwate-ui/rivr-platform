import { describe, expect, it } from 'vitest';
import { BRAND_KIT, IPHONE_SCREENS } from './brandKit.ts';

const at = (path: string) => BRAND_KIT.find((output) => output.path === path);

const DENSITIES = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]] as const;

describe('the brand kit', () => {
  it('writes each file once, at a whole number of pixels', () => {
    expect(new Set(BRAND_KIT.map((output) => output.path)).size).toBe(BRAND_KIT.length);
    for (const output of BRAND_KIT) {
      expect(Number.isInteger(output.width) && Number.isInteger(output.height), output.path).toBe(true);
    }
  });

  it('gives the player app the manifest icons, a maskable icon and the home-screen icon', () => {
    expect(at('apps/player/public/icons/icon-192.png')).toMatchObject({ art: 'icon', width: 192 });
    expect(at('apps/player/public/icons/icon-512.png')).toMatchObject({ art: 'icon', width: 512 });
    expect(at('apps/player/public/icons/maskable-512.png')).toMatchObject({ art: 'maskable', width: 512 });
    expect(at('apps/player/public/icons/apple-touch-icon.png')).toMatchObject({ art: 'icon', width: 180 });
  });

  it('gives every iPhone screen size its launch screen, the Plus models and the Air included', () => {
    for (const [width, height] of [[1242, 2208], [1260, 2736], [640, 1136], [1320, 2868]]) {
      expect(at(`apps/player/public/splash/apple-splash-${String(width)}x${String(height)}.png`), `${String(width)}x${String(height)}`).toMatchObject({ art: 'lockup', width, height });
    }
    expect(BRAND_KIT.filter((output) => output.path.includes('/splash/apple-splash-'))).toHaveLength(IPHONE_SCREENS.length);
  });

  it('gives both Android apps a launcher icon, round icon, adaptive foreground and splash at every density', () => {
    for (const app of ['tablet', 'driver']) {
      const res = `apps/${app}/android/app/src/main/res`;
      for (const [density, dp] of DENSITIES) {
        expect(at(`${res}/mipmap-${density}/ic_launcher.png`)).toMatchObject({ art: 'icon', width: 48 * dp });
        expect(at(`${res}/mipmap-${density}/ic_launcher_round.png`)).toMatchObject({ art: 'maskable', width: 48 * dp });
        expect(at(`${res}/mipmap-${density}/ic_launcher_foreground.png`)).toMatchObject({ art: 'adaptive', width: 108 * dp });
        expect(at(`${res}/drawable-port-${density}/splash.png`)).toMatchObject({ art: 'lockup' });
        expect(at(`${res}/drawable-land-${density}/splash.png`)).toMatchObject({ art: 'lockup' });
      }
    }
  });

  it('gives every publishing channel a profile image that reads as a small circle, and wide covers the wordmark', () => {
    for (const channel of ['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google-business', 'whatsapp']) {
      const profile = BRAND_KIT.find((output) => output.path.startsWith(`docs/brand/social/${channel}-`) && output.width === output.height);
      expect(profile, channel).toMatchObject({ art: 'maskable' });
    }
    expect(at('docs/brand/social/youtube-banner.png')).toMatchObject({ art: 'lockup', width: 2560, height: 1440 });
  });
});
