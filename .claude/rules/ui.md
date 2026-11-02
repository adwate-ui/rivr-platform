---
paths:
  - "packages/ui/**"
  - "packages/tokens/**"
  - "packages/render/**"
  - "apps/**"
---

# UI: one library, no exceptions

Every pixel in every app comes from `@rivr/ui`. Every value comes from `packages/tokens/tokens.json`, the single design source; its CSS, Tailwind, TypeScript and Android outputs are generated and never edited by hand. See "Design system" in `docs/spec/additions-2026-10-14.md`.

## What lives in `@rivr/ui`
The package's README lists each with its props; this is the map (F5-18: only what exists, so a review never asks for a component that is not there).
- Layout: Box, Stack, Inline, Grid, Divider, Container, Screen, SplitView, StepScreen, StepList, LoadState, `useIsWide`
- Type: Text, Heading, Label, Money, Number, Time, Stakes, Icon, Wordmark, BrandIcon, BrandArt
- Controls: Button (primary, secondary, text, danger), Input, TextArea, ChoiceChips, ChoiceSheet, Switch, QuantityStepper, PinPad, Keypad, SignaturePad, CameraButton (a file), CameraCapture (a photo taken there and then), CodeInput, Captcha, ReasonForm, ConfirmButton, ConfirmQuestion, PlaybackLink, QrScanView
- Feedback: ErrorMessage, StatusMessage, StaleNotice, OfflineBanner, KillSwitchBanner, CookieBanner, InstallOffer, PromptBar, LockedNotice, FeatureGate
- Data: DataTable (sort, filter, export, virtualisation), HistoryRow, FloorRow, KycPhoto, VenueLogo, QrCode, Chart, Heatmap, TierMatrix
- Shells and navigation: PlayerShell, ConsoleShell, TabletShell, DisplayShell, WebShell, BottomNav, SideNav, Tabs
- Domain: SeatRing, TableCard, CallTimeTimer, DrillTable, MembershipCard, PromotionCard, PromotionPager, ReferralCard, SocialCard, TournamentClock, Receipt, ThermalReceipt, and the TV boards (TvWaitlistBoard, TvCallTimeBoard, TvJackpotBoard, TvTournamentClock, TvPromotionSlide, TvBoardProgress)
- Documents: PrintSheet, DocumentPage, DocumentTable, InvoiceDocument, OfflinePackDocument, PartnerStatementDocument, DisplayPreview, WebPreview, StreamOverlay
- Website blocks: HeroBlock, TextBlock, RulesBlock, FaqBlock, CareersBlock, MapBlock, GamesBlock, CalendarBlock, LinksBlock, StatementBlock, GalleryBlock, FeatureBlock, StoryBlock, CardsBlock, MarqueeBlock, TimelineBlock, TableBlock, PromotionsBlock, WebBand, WebFooter
- Not here, on purpose: no Modal, Toast, Select, Checkbox, Radio, Tooltip, Skeleton, EmptyState, Badge, Avatar or DatePicker. A screen asks in place (ConfirmButton, ConfirmQuestion, ChoiceSheet), says an outcome inline (StatusMessage, ErrorMessage), picks with ChoiceChips or Switch, shows loading and empty states with Screen and LoadState, and takes a day with `Input type="date"`. Add one only through the `new-ui-component` skill, when a screen needs it.

## In `apps/` you may not
- write any lowercase JSX element (`<div>`, `<span>`, `<button>`, `<img>`, `<svg>`...)
- use `className` or `style`
- add a CSS file or import any stylesheet except `@rivr/ui/styles.css`
- import Radix, Tailwind, an icon set or any styling library

A hook blocks these on write; ESLint blocks them in CI. Feature components in apps hold behaviour and data wiring only.

## In `packages/ui/`
- Tailwind classes only from the token preset. No hex, px or font name.
- One component per folder: `Component.tsx`, `Component.stories.tsx`, `Component.test.tsx`, `index.ts`.
- Stories for default, loading, empty, error and long text. RIVR is English only (#186).
- Accessible: labels, focus order, 4.5:1 contrast, 44 px touch targets for player and tablet, and for the console below 1180 px (decision 0282).
- Prefer a prop or variant on an existing component over a new component.
- `@rivr/render` templates compose `@rivr/ui`; they define no styles.

## Visual standard
- Dark only. Flat surfaces, gold hairlines at 25%, radius 6 px maximum, motion 200 ms ease-out on state changes only, besides a busy button's turning circle and the TV's progress bar.
- One gold filled button per screen at most.
- No decorative poker imagery, gradients, glass, glows or shadows beyond a modal's.
- A reward's or a dish's own photograph, the club's and never stock, in `ItemPhoto`'s 4:3 tile, with its initial until one is added (AS-11); no other image slots.
- Do not copy from the prototype: the demo bar, the Claude Design badge, its image slots, device-frame radii, placeholder payee details.

## Public website (decision 0118)
The public website's blocks (`WebBand` and the blocks it holds) are the one exception to the visual standard above. They may use:
- cream bands with ink text (`color.ink`, `color.inkMuted`);
- the club's own photos and video from `apps/web/public/media`, never stock or decorative imagery, with a "Concept visualisation" note where the teaser has one;
- a dark overlay on media so its words stay legible, flat or fading to the foot of a photo tile under its caption;
- a muted looping hero video that shows its still under `prefers-reduced-motion`;
- one gold filled button per band.

Headlines may be short statements. Everything else holds: tokens only, `@rivr/ui` only, radius 6 px at most.
