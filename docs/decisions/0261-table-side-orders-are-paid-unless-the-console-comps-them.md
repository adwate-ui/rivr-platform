# 0261: Table-side orders are paid unless the console comps them, and reach the bar as KOTs

Date: 2026-10-27 · Owner's decisions for #123: question #531 ("as recommended"), #565 (alcohol 21 and over only) and "Build ESC/POS, details later" for the bar printer.

**What.**
- **The menu** (`fnb_item`) is each venue's list of items, with no prices: Glaza prices and charges them. Staff with `fnb.manage` add items and take them off the menu.
- **Who orders.** A seated member orders in the player app (`fnb.table_side`), one order a minute; the dealer orders for a seat on the tablet during their down; staff with `fnb.manage` order for a seat at the console.
- **Paid or comp.** App and tablet orders are always paid to Glaza by the player. Only the console can comp an order, which RIVR pays Glaza for through the monthly import (#109).
- **Alcohol** in the player app is offered and accepted only for a member 21 or over by their KYC date of birth. The dealer and staff, who see the player, order it for a seat (#565).
- **The visit.** Each order belongs to the seat's session, so it is on that visit.
- **The KOT.** Each order has a KOT number, counted per venue and night, and emits `fnb.ordered`. The cage agent (decision 0260) claims those and prints them over the network on the bar's ESC/POS printer (`RIVR_BAR_PRINTER`). Until it runs, the console's KOTs to print list carries them: staff hand each to the bar and mark it sent, and the agent never prints a KOT marked sent.
- **The practice venue** never reaches the bar: `claim_agent_kots` gives an agent no practice venue's KOTs, so they are only ever marked sent by hand.
- **Later:** the printer's model and address, which change only `RIVR_BAR_PRINTER` and, if needed, the ESC/POS bytes in `@rivr/adapters/kitchen-printer-escpos`.
