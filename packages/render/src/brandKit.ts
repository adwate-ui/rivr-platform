import type { BrandArtKind } from '@rivr/ui';

/** One file of the brand kit: which art, at what size, written where (relative to the repository). */
export interface BrandOutput {
  readonly path: string;
  readonly art: BrandArtKind;
  readonly width: number;
  readonly height: number;
}

/** Android screen densities and how many pixels a dp is at each. */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
] as const;

// Capacitor's splash sizes per density, portrait (landscape is the same turned): not exact multiples.
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] } as const;

/** A launcher icon (48 dp), its round form, the adaptive foreground (108 dp) and the splash, per density. */
function androidApp(app: 'tablet' | 'driver'): BrandOutput[] {
  const res = `apps/${app}/android/app/src/main/res`;
  const perDensity = DENSITIES.flatMap(([density, dp]): BrandOutput[] => {
    const [short, long] = SPLASH[density];
    return [
      { path: `${res}/mipmap-${density}/ic_launcher.png`, art: 'icon', width: 48 * dp, height: 48 * dp },
      { path: `${res}/mipmap-${density}/ic_launcher_round.png`, art: 'maskable', width: 48 * dp, height: 48 * dp },
      { path: `${res}/mipmap-${density}/ic_launcher_foreground.png`, art: 'adaptive', width: 108 * dp, height: 108 * dp },
      { path: `${res}/drawable-port-${density}/splash.png`, art: 'lockup', width: short, height: long },
      { path: `${res}/drawable-land-${density}/splash.png`, art: 'lockup', width: long, height: short },
    ];
  });
  return [...perDensity, { path: `${res}/drawable/splash.png`, art: 'lockup', width: 480, height: 320 }];
}

// iPhone launch screens, portrait, in device pixels: from the 4-inch SE to the 6.9-inch Pro Max.
const IPHONE_SCREENS = [
  [640, 1136], [750, 1334], [828, 1792], [1125, 2436], [1170, 2532], [1179, 2556],
  [1206, 2622], [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868],
] as const;

/** The player app as an installed PWA: icons for the manifest and the home screen, and iPhone launch screens. */
function playerPwa(): BrandOutput[] {
  const pub = 'apps/player/public';
  const icons: BrandOutput[] = [
    { path: `${pub}/icons/icon-192.png`, art: 'icon', width: 192, height: 192 },
    { path: `${pub}/icons/icon-512.png`, art: 'icon', width: 512, height: 512 },
    { path: `${pub}/icons/maskable-512.png`, art: 'maskable', width: 512, height: 512 },
    { path: `${pub}/icons/apple-touch-icon.png`, art: 'icon', width: 180, height: 180 },
    { path: `${pub}/icons/favicon-32.png`, art: 'icon', width: 32, height: 32 },
  ];
  const launch = IPHONE_SCREENS.map(([width, height]): BrandOutput => ({ path: `${pub}/splash/apple-splash-${width}x${height}.png`, art: 'lockup', width, height }));
  return [...icons, ...launch];
}

// Each channel's profile image and cover at its recommended upload size (docs/brand/README.md).
const CHANNELS = [
  ['instagram-profile', 1080, 1080],
  ['facebook-profile', 720, 720],
  ['facebook-cover', 1640, 624],
  ['x-profile', 400, 400],
  ['x-header', 1500, 500],
  ['linkedin-logo', 400, 400],
  ['linkedin-cover', 1128, 191],
  ['youtube-profile', 800, 800],
  ['youtube-banner', 2560, 1440],
  ['telegram-profile', 640, 640],
  ['google-business-logo', 720, 720],
  ['google-business-cover', 1024, 576],
  ['whatsapp-profile', 640, 640],
] as const;

/** Every file the brand kit writes (`pnpm --filter @rivr/render render:brand-kit`). */
export const BRAND_KIT: readonly BrandOutput[] = [
  ...playerPwa(),
  ...androidApp('tablet'),
  ...androidApp('driver'),
  ...CHANNELS.map(([name, width, height]): BrandOutput => ({ path: `docs/brand/social/${name}.png`, art: 'lockup', width, height })),
];
