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

Adding a template: a component in `src/templates/` that composes `@rivr/ui` and takes plain props, registered in `src/templates/index.ts`, with copy in the `@rivr/i18n` namespace of its surface (`tv` for TV slides).

## Must not

- Define styles. A template that needs a new look gets it from a new `@rivr/ui` component or variant.
- Use Satori or any renderer other than Chromium; it would drift from the apps (`docs/engineering/stack.md`).
- Compute money. Templates show amounts they are given.
- Be imported by browser code. It is Node only and launches Chromium per call; a long-running render service should keep one browser open (not built yet, nor Remotion video).
