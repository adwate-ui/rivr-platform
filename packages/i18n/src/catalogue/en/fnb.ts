/** Why an order did not go through (#123), the same words on every screen that orders. */
const failures = {
  not_allowed: 'Ordering is not open to you here.',
  not_seated: 'Nobody sits in that seat: order for a seat with a player in it.',
  not_on_menu: 'Something in the order is no longer on the menu. Check it and send it again.',
  too_soon: 'The bar has your last order. Wait a minute before the next.',
  too_young: 'Alcohol is ordered at 21 or over.',
  no_dealer: 'Sign a dealer in before ordering.',
  paused: 'The club is paused: orders wait until it reopens.',
  invalid: 'An order is 1 to 9 of each item, 20 lines at most.',
  unavailable: 'The order did not go through. Try again.',
} as const;

/** Table-side food and drink in the player app (#123): from the member's seat, paid to Glaza. */
export const playerFnb = {
  title: 'Food and drink',
  /** On Home while the member is seated. */
  order: 'Order food and drink',
  notSeated: 'Order from your seat: sit at a table first.',
  empty: 'Nothing is on the menu just now.',
  paid: 'Paid to Glaza when it comes to your seat.',
  send: 'Send to the bar',
  /** `{kot}` is the KOT's number; `{table}` and `{seat}` where it goes. */
  sent: 'Sent to the bar: KOT {kot}, to {table}, seat {seat}.',
  failures,
} as const;

/** Ordering for a seat on the dealer tablet (#123): paid by the player. */
export const tabletFnb = {
  open: 'Food and drink',
  title: 'Food and drink for seat {seat}',
  paid: 'Paid by the player to Glaza.',
  send: 'Send to the bar',
  sent: 'Sent to the bar: KOT {kot}.',
  close: 'Close',
  failures,
} as const;

/** The console's F&B screen (#123), for staff who run it. */
export const consoleFnb = {
  title: 'Food and drink',
  notAllowed: 'Your role does not include food and drink. Ask an admin if you need it.',
  toPrint: 'KOTs to print',
  toPrintHint: 'The cage agent prints these at the bar. If it is not running, print or read each one to the bar and mark it sent.',
  noneToPrint: 'Every KOT is at the bar.',
  markSent: 'Mark KOT {kot} sent',
  tonight: 'Tonight’s orders',
  noneTonight: 'No orders tonight.',
  /** `{kot}`, the table, seat and member: `KOT 12 · Table 3, seat 5 · Yash Gupta (1043)`. */
  order: 'KOT {kot} · {table}, seat {seat} · {member} ({number})',
  line: '{quantity} × {name}',
  paid: 'Paid',
  comp: 'Comp',
  byAgent: 'Printed at the bar',
  byStaff: 'Given to the bar by hand',
  waiting: 'Not at the bar yet',
  newOrder: 'Order for a seat',
  table: 'Table',
  seat: 'Seat',
  /** A seat to order for: `Table 3, seat 5 · Yash Gupta`. */
  seatChoice: '{table}, seat {seat} · {name}',
  isComp: 'Comp it: RIVR pays Glaza',
  send: 'Send to the bar',
  sent: 'Sent to the bar: KOT {kot}.',
  items: 'Menu',
  itemName: 'Item',
  kind: 'Kind',
  kinds: { food: 'Food', soft_drink: 'Soft drink', alcohol: 'Alcohol' },
  position: 'Place on the menu',
  onOffer: 'On offer',
  offMenu: 'Off the menu',
  takeOff: 'Take {name} off the menu',
  putOn: 'Put {name} on the menu',
  addItem: 'Add to the menu',
  invalidItem: 'An item needs a name of 1 to 60 characters and a place from 1 to 999.',
  failures,
} as const;
