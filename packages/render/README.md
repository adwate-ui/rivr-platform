# @rivr/render

Draws `@rivr/ui` components to PNG, PDF and MP4 in headless Chromium (Playwright), so TV slides, social and winner cards, receipts, the membership card and the logo animation use exactly the CSS the apps use. Node only.

A small Vite page, the render host (`src/host/`), loads `@rivr/ui/styles.css`, mounts the template named in its `?job=` parameter with its props, and marks itself ready once the webfonts are in. `renderToPng` and `renderToPdf` open that page at the requested size and capture it.

## Public API

| Export | What it does |
|---|---|
| `renderToPng({ template, props, width, height, scale })` | A `Buffer` holding a PNG of exactly `width` × `height` pixels, times `scale` (1 unless set). Without `height`, the page is as tall as what it draws, as a receipt is; with it, a template that draws more than fits is refused, never cut off. |
| `renderToPdf({ template, props, width, height })` | A one-page PDF of `width` × `height` CSS pixels, backgrounds printed. |
| `renderToMp4(request, { fps, durationMs, leadMs })` | An H.264 MP4 of the template's CSS animations: each frame captured with every animation held at its time, after `leadMs` of still frames, encoded in Chromium (WebCodecs) and written by Mediabunny (`docs/decisions/0039`). |
| `templates`, `TemplateName`, `TemplateProps<Name>` | The template registry; props are type-checked per template. |
| `RenderRequest<Name>` | The request type. |
| `renderInvoicePdf(invoice)`, `storedInvoiceFromRow(row)`, `StoredInvoice` | A stored invoice (#68), read from its `invoice` row, as a one-page A4 PDF through `document.invoice`: `@rivr/ui`'s `InvoiceDocument`, which the player app shows too (#249) (decision 0111). |

Templates:

| Name | Size | Props |
|---|---|---|
| `tv.badBeatJackpot` | 1920 × 1080 | The jackpot as the TV shows it (`TvJackpotBoard`): `amountPaise: bigint`, and tonight's high hand `highHand: { title, line }` as the TV words it (absent before one) |
| `tv.waitlist` | 1920 × 1080 | The waitlist board (`TvWaitlistBoard`): `stakes`, each with its name, the tables open and its places, a player as a first name and initial |
| `tv.tournamentClock` | 1920 × 1080 | The tournament clock (`TvTournamentClock`): `name`, `level`, `remainingSeconds`, `isPaused`, `blinds` and `next` (`{ small, big, ante }` in chips; `next` absent on the last level), `players`, `entries`, `averageStack` (chips), `poolPaise`, `payoutsPaise` (first place first; empty before they are set) |
| `tv.promotion` | 1920 × 1080 | A promotion in the TV's rotation (`TvPromotionSlide`): `title`, `detail` and `when` as published, and `position: { current, count }` for the quiet pager (shown only with more than one) |
| `social.tournamentPoster` | feed or story | `name`, `startsAt` (ISO), `buyInPaise`, `guaranteePaise` (absent for a tournament without one), `venue` |
| `social.promoCard` | feed or story | `title`, `rewardPaise` (when the reward is an amount), `runs` and `who` (as the promotion builder words them, in IST), `venue` |
| `social.winnerCard` | feed or story | `playerName` (as the player agreed to be shown), `eventName`, `prizePaise` (as announced, before TDS), `wonAt` (ISO), `venue` |
| `social.highHandCard` | feed or story | `hand`, `playerName`, `tableName`, `bonusPaise`, `at` (ISO), `venue` |
| `brand.art` | any | `art`: `icon`, `maskable`, `adaptive` or `lockup` (`BrandArt`, drawn on a fixed stage and scaled to the request); `isAnimated` with `lockup` for the logo animation |
| `card.membership` | `tokens.viewport.card` (342 × 216) at `scale: 3` | `name`, `tier`, `memberNumber`. The QR square is empty: the QR rotates, so the app draws it live (#71) |
| `receipt.thermal` | `tokens.size.receipt` (576) wide, no height (`@rivr/ui`'s `ThermalReceipt`, which the cage prints too, #69) | `issuer` (`legalName`, `address`, `gstin`), `isPractice` (says "Practice receipt"), `title`, `at` (ISO), `lines` (`label` and an amount in paise or words), `total`, `reference` |
| `document.invoice` | `tokens.viewport.a4` (794 × 1123) | `invoice`: a `StoredInvoice` (`@rivr/ui`'s `InvoiceDocument`), its amounts and supplier exactly as stored |
| `document.statement` | `tokens.viewport.a4` | `issuer`, `holder`, `from` and `to` (ISO dates), `openingPaise`, `movements` (`at`, `description`, `amountPaise`, `balancePaise`), `closingPaise` |
| `document.partnerStatement` | `tokens.viewport.a4` | `statement`: a `PartnerStatement` (`@rivr/ui`'s `PartnerStatementDocument`, which the console shows too, #98): the holder, month and holding, revenue and expenses by account, the net and the holder's share |

The brand kit (`docs/brand/README.md`) is `brand.art` at every size in `src/brandKit.ts`. `pnpm --filter @rivr/render render:brand-kit` rebuilds the tokens, `@rivr/ui` and the host, then writes all of it into the repository, 83 files in under a minute. `src/brand.test.ts` compares six of them with `baselines/brand-*.png`.

The logo animation is `brand.art` animated, drawn to MP4 for a reel (1080 × 1920) and the TV (1920 × 1080), four seconds at 30 frames a second (`src/logo.ts`). `pnpm --filter @rivr/render render:logo` writes `docs/brand/logo-reel.mp4` and `docs/brand/logo-tv.mp4` in about 20 seconds. Each tile rises in `motion.duration.state` (200 ms, ease-out), one `motion.duration.stagger` (120 ms) after the last; the mark itself never changes. Frames are the same on every run; the encoded bytes are not, so a rerun rewrites both files. `renderFrameToPng(request, atMs)` draws one frame, for checking the motion.

The social cards are `SocialCard` from `@rivr/ui`, which fills the page, so the render request alone sets the format. Use `tokens.viewport.feed` (1080 × 1350) for a post and `tokens.viewport.story` (1080 × 1920) for a story. Times show in IST. `venue` is the club's address from venue configuration. Their copy is in the `social` namespace of `@rivr/i18n`. `pnpm test --filter render -- social` draws all eight and compares them with `baselines/social-*.png`.

Printed matter (`Receipt`, `DocumentPage` and `DocumentTable` from `@rivr/ui`) is ink on cream (`docs/decisions/0160`). The receipt is one CSS pixel to each printer dot, so print the PNG at `scale` 1. Its copy and the documents' are in the `documents` namespace. `pnpm test --filter render -- paper` draws the card, the receipt, and the invoice and statement as PNG and PDF, and compares them with `baselines/card-*.png`, `receipt-*.png` and `document-*.png`.

## Usage

```ts
import { renderToPng } from '@rivr/render';

const png = await renderToPng({
  template: 'tv.badBeatJackpot',
  props: { amountPaise: 34_260_000n }, // ₹3,42,600
  width: 1920,
  height: 1080,
});
```

Build the host first: `pnpm --filter @rivr/render build` (Turborepo builds `@rivr/ui` before it). The tests build it themselves and compare the sample slide with `baselines/tv-bad-beat-jackpot.png`, and each TV layout with its `baselines/tv-*.png` (`pnpm test --filter render -- tv`); after a deliberate design change, run `RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test` and review the new PNG. Bigint props survive the trip to the page (`src/job.ts`).

Adding a template: a component in `src/templates/` that composes `@rivr/ui` and takes plain props, registered in `src/templates/index.ts`, with copy in the `@rivr/i18n` namespace of its surface (`tv` for TV slides, `social` for posts, `documents` for printed matter). Those three are registered in `src/messages.ts`; a template reading another namespace adds it there, or `t` shows its keys. Tests compare with a baseline through `src/test/png.ts`.

## Must not

- Define styles. A template that needs a new look gets it from a new `@rivr/ui` component or variant.
- Use Satori or any renderer other than Chromium; it would drift from the apps (`docs/engineering/stack.md`).
- Compute money. Templates show amounts they are given.
- Be imported by browser code. It is Node only and launches Chromium per call; a long-running render service should keep one browser open (not built yet).
