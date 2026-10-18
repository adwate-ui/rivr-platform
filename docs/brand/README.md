# RIVR brand kit

Every app icon, splash screen, profile image and cover is drawn by `@rivr/render` from `BrandArt` in `@rivr/ui`. The colours come from the tokens. Never edit these images by hand. After a brand change, run:

```
pnpm --filter @rivr/render render:brand-kit
```

Then commit what it writes. The list of files and their sizes is `packages/render/src/brandKit.ts`.

## What it writes

| Where | What |
|---|---|
| `apps/player/public/icons/` | PWA icons 192 and 512, a maskable 512 (the card inside the safe circle), the home-screen icon 180 and the favicon 32 (#16 wires them into the manifest) |
| `apps/player/public/splash/` | iPhone launch screens, `apple-splash-<width>x<height>.png`, from 640 × 1136 to 1320 × 2868 |
| `apps/tablet/…/res`, `apps/driver/…/res` | Android launcher icon, round icon and adaptive foreground at every density (the adaptive background is the token green), and the splash for portrait and landscape |
| `docs/brand/social/` | A profile image and cover for each publishing channel, at its recommended upload size (below) |

## Channels

| Channel | Profile | Cover |
|---|---|---|
| Instagram | `instagram-profile.png` 1080 × 1080 | none |
| Facebook | `facebook-profile.png` 720 × 720 | `facebook-cover.png` 1640 × 624 |
| X | `x-profile.png` 400 × 400 | `x-header.png` 1500 × 500 |
| LinkedIn | `linkedin-logo.png` 400 × 400 | `linkedin-cover.png` 1128 × 191 |
| YouTube | `youtube-profile.png` 800 × 800 | `youtube-banner.png` 2560 × 1440; the mark stays inside the 1546 × 423 safe area |
| Telegram | `telegram-profile.png` 640 × 640 | none |
| Google Business Profile | `google-business-logo.png` 720 × 720 | `google-business-cover.png` 1024 × 576 |
| WhatsApp | `whatsapp-profile.png` 640 × 640 | none |

Every profile image keeps the wordmark clear of a circular crop.

## Handles and bios

The owner chooses the handles when opening the accounts; that is people's work, not code. The bio follows the copy rules (no exclamation marks, emoji or banned words): "A members' poker club. Upper floor, Glaza, M3M 65th Avenue, Gurugram."
