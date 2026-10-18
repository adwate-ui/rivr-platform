import { describe, expect, it } from 'vitest';
import { BRAND_KIT } from './brandKit.ts';

const at = (path: string) => BRAND_KIT.find((output) => output.path === path);

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

  it('gives both Android apps a launcher icon, round icon, adaptive foreground and splash at every density', () => {
    for (const app of ['tablet', 'driver']) {
      const res = `apps/${app}/android/app/src/main/res`;
      expect(at(`${res}/mipmap-mdpi/ic_launcher.png`)).toMatchObject({ width: 48 });
      expect(at(`${res}/mipmap-xxxhdpi/ic_launcher_round.png`)).toMatchObject({ art: 'maskable', width: 192 });
      expect(at(`${res}/mipmap-xxxhdpi/ic_launcher_foreground.png`)).toMatchObject({ art: 'adaptive', width: 432 });
      expect(at(`${res}/drawable-land-xxxhdpi/splash.png`)).toMatchObject({ width: 1920, height: 1280 });
    }
  });

  it('gives every publishing channel a profile image', () => {
    for (const channel of ['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google-business', 'whatsapp']) {
      expect(BRAND_KIT.some((output) => output.path.startsWith(`docs/brand/social/${channel}-`))).toBe(true);
    }
  });
});
