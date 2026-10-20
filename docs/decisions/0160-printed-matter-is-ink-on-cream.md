# 0160: Printed matter is ink on cream; the card image carries no QR

Date: 2026-10-20 · Task: #67

Product screens are dark only, but receipts, invoices and statements are printed. A green A4 page wastes
toner and a thermal printer has only one ink, so printed matter uses the two colours the wordmark's tiles
already pair: ink text on cream. No new colour is added. A thermal printer reads cream as paper and ink as a
dot; a gold hairline would vanish, so receipts rule with dashed ink. A4 rows keep the gold hairline, which
prints as a light rule.

The receipt is drawn 576 px wide, `tokens.size.receipt`, one CSS pixel to each dot of 80 mm paper at
203 dpi (the receipt printer adapter's width), and as tall as its lines. A4 is 794 by 1123 CSS pixels,
`tokens.viewport.a4`. The membership card is an ID-1 card at a phone's content width, 342 by 216
(`tokens.viewport.card`); `@rivr/render` draws it at scale 3 for a sharp image.

The card's QR rotates (#71), so the app draws it live in `MembershipCard`'s QR square. A rendered card image
leaves the square empty: an image never carries a code that could be replayed at the door.
