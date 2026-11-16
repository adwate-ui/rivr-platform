import { describe, expect, it } from 'vitest';
import { chromeIntentOf, inAppBrowserOf } from './inAppBrowser.ts';

// User agents as these browsers send them.
const AGENTS = {
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 336.0.3.20.86 (iPhone15,2; iOS 17_5; en_IN; en; scale=3.00; 1179x2556; 609317428)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 Instagram 334.0.0.42.95 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_IN; 607720843)',
  facebookIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/462.0.0.38.105;FBBV/584296429;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.4.1;FBSS/3;FBCR/;FBID/phone;FBLC/en_GB;FBOP/5;FBRV/586453185]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/439.0.0.29.119;]',
  messengerIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0.0.38.109;FBBV/509187018;FBDV/iPhone13,2;FBMD/iPhone;FBSN/iOS;FBSV/16.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  googleAppAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 GSA/15.21.32.29.arm64',
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

describe("Instagram's and Facebook's in-app browsers", () => {
  it.each([
    ['instagramIphone', 'instagram', 'iphone'],
    ['instagramAndroid', 'instagram', 'android'],
    ['facebookIphone', 'facebook', 'iphone'],
    ['facebookAndroid', 'facebook', 'android'],
    ['messengerIphone', 'facebook', 'iphone'],
  ] as const)('finds %s', (agent, app, platform) => {
    expect(inAppBrowserOf(AGENTS[agent])).toEqual({ app, platform });
  });

  it.each(['safariIphone', 'chromeIphone', 'chromeAndroid', 'googleAppAndroid', 'chromeDesktop'] as const)('leaves %s alone', (agent) => {
    expect(inAppBrowserOf(AGENTS[agent])).toBeNull();
  });

  it('opens the same address in Chrome on Android, or the phone\'s browser without Chrome', () => {
    expect(chromeIntentOf('https://app.rivr.test/sign-in?next=%2Fbonus')).toBe(
      'intent://app.rivr.test/sign-in?next=%2Fbonus#Intent;scheme=https;package=com.android.chrome;'
      + 'S.browser_fallback_url=https%3A%2F%2Fapp.rivr.test%2Fsign-in%3Fnext%3D%252Fbonus;end',
    );
  });
});
