# @rivr/render

Draws `@rivr/ui` components to PNG, PDF and MP4 in headless Chromium (Playwright), so TV slides, receipts and the logo animation use exactly the CSS the apps use. Node only.

A small Vite page, the render host (`src/host/`), loads `@rivr/ui/styles.css`, mounts the template named in its `?job=` parameter with its props, and marks itself ready once the webfonts are in. `renderToPng` and `renderToPdf` open that page at the requested size and capture it.

## Public API

| Export | What it does |
|---|---|
| `renderToPng({ template, props, width, height, scale })` | A `Buffer` holding a PNG of exactly `width` × `height` pixels, times `scale` (1 unless set). Without `height`, the page is as tall as what it draws, as a receipt is; with it, a template that draws more than fits is refused, never cut off. |
| `renderToPdf({ template, props, width, height, pages })` | A PDF of `width` × `height` CSS pixels, backgrounds printed: one page, or with `pages: 'all'` as many as the template draws (the offline pack, #167). A one-page request refuses a template that draws more than fits. |
| `renderToMp4(request, { fps, durationMs, leadMs })` | An H.264 MP4 of the template's CSS animations: each frame captured with every animation held at its time, after `leadMs` of still frames, encoded in Chromium (WebCodecs) and written by Mediabunny (`docs/decisions/0039`). |
| `templates`, `TemplateName`, `TemplateProps<Name>` | The template registry; props are type-checked per template. |
| `RenderRequest<Name>` | The request type. |
| `offlinePackFromRow(row)`, `renderOfflinePackPdf(pack)` | The offline pack (#168) from `public.offline_pack`'s row, and as a PDF of A4 pages. `pnpm --filter @rivr/render render:offline-packs` (`scripts/render-offline-packs.ts`, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) makes every real venue's pack into the private bucket `offline-packs` and keeps each venue's newest seven: `.github/workflows/offline-pack.yml` runs it nightly. |
| `renderInvoicePdf(invoice)`, `storedInvoiceFromRow(row)`, `StoredInvoice` | A stored invoice (#68), read from its `invoice` row with the SAC code, place of supply and signatory it was issued with (#423), as a one-page A4 PDF through `document.invoice`: `@rivr/ui`'s `InvoiceDocument`, which the player app shows too (#249) (decision 0111). |

Templates:

| Name | Size | Props |
|---|---|---|
| `tv.waitlist` | 1920 × 1080 | The waitlist board (`TvWaitlistBoard`): `stakes`, each with its name, the tables open and its places, a player as a first name and initial |
| `tv.promotion` | 1920 × 1080 | A promotion in the TV's rotation (`TvPromotionSlide`): `title`, `detail` and `when` as published, and `position: { current, count }` for the quiet pager (shown only with more than one) |
| `brand.art` | any | `art`: `icon`, `maskable`, `adaptive` or `lockup` (`BrandArt`, drawn on a fixed stage and scaled to the request); `isAnimated` with `lockup` for the logo animation |
| `receipt.thermal` | `tokens.size.receipt` (576) wide, no height (`@rivr/ui`'s `ThermalReceipt`, #69) | `issuer` (`legalName`, `address`, `gstin`), `isPractice` (says "Practice receipt"), `title`, `at` (ISO), `lines` (`label` and an amount in paise or words), `total`, `reference` |
| `document.invoice` | `tokens.viewport.a4` (794 × 1123) | `invoice`: a `StoredInvoice` (`@rivr/ui`'s `InvoiceDocument`), its amounts and supplier exactly as stored |
| `document.statement` | `tokens.viewport.a4` | `issuer`, `holder`, `from` and `to` (ISO dates), `openingPaise`, `movements` (`at`, `description`, `amountPaise`, `balancePaise`), `closingPaise` |
| `document.partnerStatement` | `tokens.viewport.a4` | `statement`: a `PartnerStatement` (`@rivr/ui`'s `PartnerStatementDocument`, #98): the holder, month and holding, revenue and expenses by account, the net and the holder's share |
| `document.offlinePack` | `tokens.viewport.a4`, `pages: 'all'` | `pack`: an `OfflinePack` (`@rivr/ui`'s `OfflinePackDocument`, #167): who to call, open balances and the floor as it stood, each part from a new A4 page. |

The brand kit (`docs/brand/README.md`) is `brand.art` at every size in `src/brandKit.ts`. The website's shared-link image is its `share` art: the lockup beside a `backdrop` photograph the host serves from `src/host/public/brand` (see its README). `pnpm --filter @rivr/render render:brand-kit` rebuilds the tokens, `@rivr/ui` and the host, then writes all of it into the repository, 116 files in under a minute. `src/brand.test.ts` compares six of them with `baselines/brand-*.png`. Paths after the command write only the files under them.

The logo animation is `brand.art` animated, drawn to MP4 for a reel (1080 × 1920) and the TV (1920 × 1080), four seconds at 30 frames a second (`src/logo.ts`). `pnpm --filter @rivr/render render:logo` writes `docs/brand/logo-reel.mp4` and `docs/brand/logo-tv.mp4` in about 20 seconds. Each tile rises in `motion.duration.state` (200 ms, ease-out), one `motion.duration.stagger` (120 ms) after the last; the mark itself never changes. Frames are the same on every run; the encoded bytes are not, so a rerun rewrites both files. `renderFrameToPng(request, atMs)` draws one frame, for checking the motion.

Printed matter (`Receipt`, `DocumentPage` and `DocumentTable` from `@rivr/ui`) is ink on cream (`docs/decisions/0160`). The receipt is one CSS pixel to each printer dot, so print the PNG at `scale` 1. Its copy and the documents' are in the `documents` namespace. `pnpm test --filter render -- paper` draws the receipt, and the invoice and statement as PNG and PDF, and compares them with `baselines/receipt-*.png` and `document-*.png`.

## Usage

```ts
import { renderToPng } from '@rivr/render';

const png = await renderToPng({
  template: 'tv.promotion',
  props: { title: 'High hands', when: 'Every night' },
  width: 1920,
  height: 1080,
});
```

Build the host first: `pnpm --filter @rivr/render build` (Turborepo builds `@rivr/ui` before it). The tests build it themselves and compare the sample slide with `baselines/tv-promotion-plain.png`, and each TV layout with its `baselines/tv-*.png` (`pnpm test --filter render -- tv`); after a deliberate design change, run `RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test` and review the new PNG. Bigint props survive the trip to the page (`src/job.ts`).

Adding a template: a component in `src/templates/` that composes `@rivr/ui` and takes plain props, registered in `src/templates/index.ts`, with copy in the `@rivr/i18n` namespace of its surface (`tv` for TV slides, `documents` for printed matter). Those two are registered in `src/messages.ts`; a template reading another namespace adds it there, or `t` shows its keys. Tests compare with a baseline through `src/test/png.ts`.

## Must not

- Define styles. A template that needs a new look gets it from a new `@rivr/ui` component or variant.
- Use Satori or any renderer other than Chromium; it would drift from the apps (`docs/engineering/stack.md`).
- Compute money. Templates show amounts they are given.
- Be imported by browser code. It is Node only and launches Chromium per call; a long-running render service should keep one browser open (not built yet).
