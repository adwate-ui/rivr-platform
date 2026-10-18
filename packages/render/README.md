# @rivr/render

Draws `@rivr/ui` components to PNG and PDF in headless Chromium (Playwright), so TV slides, social and winner cards, receipts and the membership card use exactly the CSS the apps use. Node only.

A small Vite page, the render host (`src/host/`), loads `@rivr/ui/styles.css`, mounts the template named in its `?job=` parameter with its props, and marks itself ready once the webfonts are in. `renderToPng` and `renderToPdf` open that page at the requested size and capture it.

## Public API

| Export | What it does |
|---|---|
| `renderToPng({ template, props, width, height })` | A `Buffer` holding a PNG of exactly `width` × `height` pixels. |
| `renderToPdf({ template, props, width, height })` | A one-page PDF of `width` × `height` CSS pixels, backgrounds printed. |
| `templates`, `TemplateName`, `TemplateProps<Name>` | The template registry; props are type-checked per template. |
| `RenderRequest<Name>` | The request type. |

Templates:

| Name | Size | Props |
|---|---|---|
| `tv.badBeatJackpot` | 1920 × 1080 | `amountPaise: bigint` |
| `social.tournamentPoster` | feed or story | `name`, `startsAt` (ISO), `buyInPaise`, `guaranteePaise` (absent for a tournament without one), `venue` |
| `social.promoCard` | feed or story | `title`, `rewardPaise` (when the reward is an amount), `runs` and `who` (as the promotion builder words them, in IST), `venue` |
| `social.winnerCard` | feed or story | `playerName` (as the player agreed to be shown), `eventName`, `prizePaise` (as announced, before TDS), `wonAt` (ISO), `venue` |
| `social.highHandCard` | feed or story | `hand`, `playerName`, `tableName`, `bonusPaise`, `at` (ISO), `venue` |

The social cards are `SocialCard` from `@rivr/ui`, which fills the page, so the render request alone sets the format. Use `tokens.viewport.feed` (1080 × 1350) for a post and `tokens.viewport.story` (1080 × 1920) for a story. Times show in IST. `venue` is the club's address from venue configuration. Their copy is in the `social` namespace of `@rivr/i18n`. `pnpm test --filter render -- social` draws all eight and compares them with `baselines/social-*.png`.

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

Build the host first: `pnpm --filter @rivr/render build` (Turborepo builds `@rivr/ui` before it). The tests build it themselves and compare the sample slide with `baselines/tv-bad-beat-jackpot.png`; after a deliberate design change, run `RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test` and review the new PNG. Bigint props survive the trip to the page (`src/job.ts`).

Adding a template: a component in `src/templates/` that composes `@rivr/ui` and takes plain props, registered in `src/templates/index.ts`, with copy in the `@rivr/i18n` namespace of its surface (`tv` for TV slides, `social` for posts). Tests compare with a baseline through `src/test/png.ts`.

## Must not

- Define styles. A template that needs a new look gets it from a new `@rivr/ui` component or variant.
- Use Satori or any renderer other than Chromium; it would drift from the apps (`docs/engineering/stack.md`).
- Compute money. Templates show amounts they are given.
- Be imported by browser code. It is Node only and launches Chromium per call; a long-running render service should keep one browser open (not built yet, nor Remotion video).
