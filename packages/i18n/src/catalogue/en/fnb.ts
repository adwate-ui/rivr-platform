/** Why an order did not go through (#123), the same words on every screen that orders. */
const failures = {
  not_allowed: 'Ordering is not open to you here.',
  not_seated: 'That seat is empty. Choose a seated player.',
  not_on_menu: 'An item is off the menu. Check the order.',
  too_soon: 'One order a minute. Try again shortly.',
  too_young: 'Alcohol is for members 21 and over.',
  no_dealer: 'Sign a dealer in before ordering.',
  paused: 'The club is paused: orders wait until it reopens.',
  invalid: 'Up to 9 of each item, 20 different items at most.',
  unavailable: 'Not sent. Try again.',
  /** Serving (#640): another steward got there first. */
  taken: 'Taken by someone else.',
} as const;

/** A venue's menu with nothing on offer, on every screen that shows it. */
const empty = 'Nothing on the menu.';

/** Table-side food and drink in the player app (#123): from the member's seat, paid to Glaza. */
export const playerFnb = {
  /** The Menu tab (#635), which took Balance's place. */
  title: 'Menu',
  /** On Home while the member is seated. */
  order: 'Order food and drink',
  notSeated: 'Take a seat to order.',
  empty,
  paid: 'Paid to Glaza when it comes to your seat.',
  send: 'Send to the bar',
  /** `{kot}` is the KOT's number; `{table}` and `{seat}` where it goes. */
  sent: 'Sent to the bar. Order {kot}.',
  /** The member's orders tonight, each followed to the seat (#635). */
  yourOrders: 'Your orders tonight',
  noOrders: 'No orders yet tonight.',
  /** `KOT 12 · 2 × Masala chai, 1 × Club sandwich`. */
  orderLine: 'Order {kot} · {items}',
  item: '{quantity} × {name}',
  itemsSeparator: ', ',
  progress: { placed: 'Placed', in_progress: 'Being prepared', delivered: 'Delivered' },
  ordersFailed: 'Your orders did not load.',
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
  empty,
  failures,
} as const;

/** The console's F&B screen (#123), for staff who run it. */
export const consoleFnb = {
  title: 'Food and drink',
  notAllowed: 'Not in your role. Ask an admin.',
  toPrint: 'KOTs to print',
  toPrintHint: 'If the agent is down, print or read each to the bar, then mark it sent.',
  noneToPrint: 'Every KOT is at the bar.',
  markSent: 'Mark KOT {kot} sent',
  /** Serving (#640): orders to accept, then being prepared, then delivered, each with its table, seat and time. */
  toAccept: 'To accept',
  noneToAccept: 'No orders waiting.',
  preparing: 'Being prepared',
  nonePreparing: 'Nothing being prepared.',
  delivered: 'Delivered tonight',
  noneDelivered: 'Nothing delivered yet tonight.',
  accept: 'Accept KOT {kot}',
  deliver: 'Mark KOT {kot} delivered',
  /** `{time}`: 6 min. */
  waitingFor: 'Waiting {time}',
  deliveredIn: 'Delivered in {time}',
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
  seat: 'Seat',
  /** A seat to order for: `Table 3, seat 5 · Yash Gupta`. */
  seatChoice: '{table}, seat {seat} · {name}',
  nobodySeated: 'Nobody seated.',
  isComp: 'Comp it: RIVR pays Glaza',
  send: 'Send to the bar',
  sent: 'Sent to the bar: KOT {kot}.',
  items: 'Menu',
  itemName: 'Item',
  kind: 'Kind',
  kinds: { food: 'Food', soft_drink: 'Soft drink', alcohol: 'Alcohol' },
  onOffer: 'On offer',
  offMenu: 'Off the menu',
  addItem: 'Add to the menu',
  empty,
  invalidItem: 'A name of 1 to 60 characters, a place from 1 to 999.',
  failures,
  /** Glaza's monthly statement (#109; decision 0265). */
  glaza: {
    title: 'Glaza statement',
    hint: 'Import Glaza’s CSV for a club month. Its first line names the columns: time, table, seat, item, kind, quantity, unit_cost, unit_price, comp. The time is IST, as 2026-11-14 21:30; the seat may be empty; the kind is food, soft_drink or alcohol; costs and prices are in rupees; comp is yes or no. A later import of the month stands in for the earlier one.',
    month: 'Club month',
    choose: 'Import Glaza’s CSV',
    importedLines: '{lines} lines imported for {month}.',
    empty: 'The file has no lines after its column names.',
    badLines: 'These lines do not read: {lines}. Check their time, kind, numbers and comp, then import the file again.',
    none: 'No import for this month yet.',
    imported: 'Imported {at}: {lines} lines, {matched} matched to a visit by table and time.',
    table: 'Glaza statement',
    figure: 'Figure',
    amount: 'Amount',
    figures: {
      foodComps: 'Food comped, at cost',
      softDrinkComps: 'Soft drinks comped, at cost',
      alcoholComps: 'Alcohol comped, at cost',
      comps: 'Comps owed to Glaza',
      alcoholSales: 'Alcohol sold',
      alcoholCost: 'Cost of alcohol sold',
      alcoholMargin: 'Alcohol margin',
      rivrShare: 'RIVR’s half of the margin',
      payable: 'NewCo’s payable to Glaza',
    },
    payableHint: 'The payable is the comps less RIVR’s half of the alcohol margin. Below nothing, Glaza owes RIVR.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      invalid: 'A line is out of bounds or sold outside the club month. Check the file and the month, then import it again.',
      paused: 'The club is paused: import the file when it reopens.',
      unavailable: 'The import did not go through. Try again.',
    },
  },
} as const;
