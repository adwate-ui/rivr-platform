# 0258: A share card is laid out in percent of its side

Date: 2026-10-27 · Context: #153, the referral share card; ui-guard on PR #560.

**Why.** A share card is an image, not a screen. It is drawn as one SVG at a fixed size, then saved as a PNG, so the screen's spacing and type scales (rem, breakpoints) do not apply inside it. Writing its geometry in pixels would hold raw design values outside `tokens.json`.

**What.**
- The card's side is the token `size.shareCard` (1080 px, the size chat and social apps show without scaling).
- Everything inside it is in one `LAYOUT` table in `ReferralCard.tsx`, in percent of that side: the frame's inset and line, and each text line's baseline, size and weight. Changing the token scales the whole card.
- Colours and the font come from tokens, as everywhere else. Every word on the card, the club's name included, comes from `@rivr/i18n` through `ReferralCardText`.
- Where the display font is not installed, the browser draws the card in its fallback serif. That is accepted for now: the card still reads. Embedding the font in the SVG is a follow-up if the owner wants the display face on every phone.
- A second share card reuses this pattern. A third is the time to extract a shared layout helper.
