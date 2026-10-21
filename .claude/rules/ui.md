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
- Layout: Box, Stack, Inline, Grid, Spacer, Divider, Container, ScrollArea, Screen
- Type: Text, Heading, Label, Money, Number, Time, Stakes
- Icon (one set, one component)
- Controls: Button (primary, secondary, text, danger), IconButton, Input, MoneyInput, PinPad, Keypad, Select, Toggle, Checkbox, Radio, SegmentedControl, DatePicker, SearchField, FileDrop
- Overlays and feedback: Sheet, Modal, Toast, Banner, Tooltip, Skeleton, EmptyState, ErrorState, ConfirmAction
- Data: DataTable (sort, filter, export, virtualisation), List, ListRow, Stat, Badge, Avatar, KycPhoto, QrCode, Chart
- Shells: PlayerShell, ConsoleShell, TabletShell, DisplayShell, WebShell, DriverShell; BottomNav, SideNav, Tabs, Breadcrumbs
- Domain: SeatRing, TableCard, WaitlistRow, CallTimeTimer, PromotionCard, JackpotFigure, TournamentClock, PayoutTable, Receipt, MembershipCard, HandEntry, KillSwitchBanner, FeatureGate, LockedNotice, TierMatrix, website blocks

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
- Accessible: labels, focus order, 4.5:1 contrast, 44 px touch targets for player and tablet.
- Prefer a prop or variant on an existing component over a new component.
- `@rivr/render` templates compose `@rivr/ui`; they define no styles.

## Visual standard
- Dark only. Flat surfaces, gold hairlines at 25%, radius 6 px maximum, motion 200 ms ease-out on state changes only.
- One gold filled button per screen at most.
- No decorative poker imagery, gradients, glass, glows or shadows beyond a modal's.
- Do not copy from the prototype: the demo bar, the Claude Design badge, image slots, device-frame radii, placeholder payee details.

## Public website (decision 0118)
The public website's blocks (`WebBand` and the blocks it holds) are the one exception to the visual standard above. They may use:
- cream bands with ink text (`color.ink`, `color.inkMuted`);
- the club's own photos and video from `apps/web/public/media`, never stock or decorative imagery, with a "Concept visualisation" note where the teaser has one;
- a dark overlay on media so its words stay legible, flat or fading to the foot of a photo tile under its caption;
- a muted looping hero video that shows its still under `prefers-reduced-motion`;
- one gold filled button per band.

Headlines may be short statements. Everything else holds: tokens only, `@rivr/ui` only, radius 6 px at most.
