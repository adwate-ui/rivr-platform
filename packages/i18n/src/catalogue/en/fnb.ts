/** Why an order did not go through (#123), the same words on every screen that orders. */
const failures = {
  not_allowed: 'Ordering is not open to you here.',
  not_seated: 'That seat is empty. Choose a seated player.',
  not_on_menu: 'An item is off the menu. Check the order.',
  too_soon: 'One order a minute. Try again shortly.',
  too_young: 'Alcohol is for members 21 and over.',
  no_dealer: 'Sign a dealer in before ordering.',
  account_paused: 'Account paused. Ask at the front desk.',
  paused: 'The club is paused. Order once it reopens.',
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
  order: 'Order',
  /** The same button's full name for a screen reader. */
  orderName: 'Order food and drink',
  notSeated: 'Take a seat to order.',
  /** The menu's sections, as the console sorts its items. */
  kinds: { food: 'Food', soft_drink: 'Soft drinks', alcohol: 'Bar' },
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
  /** An order staff voided (decision 0302), with their reason. */
  cancelled: 'Cancelled: {reason}',
  /** An order the member cancelled themselves (F-048). */
  cancelledByYou: 'You cancelled this order.',
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
  /** The screen's two parts (console v3): tonight's orders, and the menu. */
  tabs: { orders: 'Orders', menu: 'Menu' },
  /** Tonight's orders in three lanes, oldest first, each with its count (console v3). */
  toAccept: 'To accept',
  preparing: 'Being prepared',
  delivered: 'Delivered tonight',
  laneEmpty: 'Nothing here.',
  /** An order's card: `KOT 4`, then where it goes, `Private Room, seat 4 · Lalit Goel`, then its lines. */
  kot: 'KOT {kot}',
  where: '{table}, seat {seat} · {member}',
  line: '{quantity} × {name}',
  comp: 'Comp',
  /** How long a delivered order took, `{time}`: 6 min. */
  deliveredIn: 'Delivered in {time}',
  accept: 'Accept',
  acceptName: 'Accept KOT {kot}',
  deliver: 'Delivered',
  deliverName: 'Mark KOT {kot} delivered',
  /** A runner leaves with the order (decision 0320). */
  onWay: 'On its way',
  onWayName: 'KOT {kot} on its way',
  isOnWay: 'On its way',
  /** Voiding an order not yet delivered (decision 0302), with a reason the member sees. */
  void: 'Void',
  voidName: 'Void KOT {kot}',
  voidReason: 'Why void KOT {kot}',
  voidConfirm: 'Void the order',
  invalidVoidReason: 'Give a reason of 3 to 300 characters.',
  /** Over the lanes, the last three KOTs members cancelled tonight (F-048): `Cancelled by the member: KOT 12, KOT 15`. */
  memberCancelled: 'Cancelled by the member: {kots}',
  memberSeesReason: 'The member sees this.',
  /** The bar printer's delivery of the KOT failed or closed unprinted (console v3): never said from a clock. */
  notAtBar: 'The bar printer did not get this KOT. Print it or read it to the bar.',
  printKot: 'Print KOT',
  printKotName: 'Print KOT {kot}',
  barHasIt: 'Bar has it',
  barHasItName: 'KOT {kot}: bar has it',
  /** The KOT as the console prints it for the bar, naming no member: `Table 2, seat 9`, and when it was ordered, `21:40`. */
  kotWhere: '{table}, seat {seat}',
  orderedAt: 'Ordered {time}',
  /** Ordering for a seat (console v3): the table first, then the seat and who sits there, then the items. */
  newOrder: 'New order',
  table: 'Table',
  seat: 'Seat',
  /** A seat to order for: `3 · Sakshi Tandon`. */
  seatChoice: '{seat} · {name}',
  nobodySeated: 'Nobody seated.',
  orderItems: 'Items',
  isComp: 'Comp it: RIVR pays Glaza',
  cancel: 'Cancel',
  send: 'Send to the bar',
  sent: 'Sent to the bar: KOT {kot}.',
  itemName: 'Item',
  kind: 'Kind',
  /** What a dish is (F-052): the mark the app shows beside its name, and a line under it. */
  diet: 'Diet',
  dietNone: 'Not set',
  diets: { veg: 'Veg', egg: 'Egg', non_veg: 'Non-veg' },
  description: 'Description',
  /** What the member asked of the bar, on the order's card. */
  note: 'Whole order: {note}',
  /** The menu's kinds and its sections, as the app names them (#799). */
  kinds: { food: 'Food', soft_drink: 'Soft drinks', alcohol: 'Bar' },
  onOffer: 'On offer',
  offMenu: 'Off the menu',
  addItem: 'Add to the menu',
  empty,
  invalidItem: 'A name of 1 to 60 characters, a place from 1 to 999.',
  failures,
  /** The menu from a CSV (#799): each line shown, and what is wrong with it, before anything is saved. No price: the menu keeps none. */
  menuCsv: {
    heading: 'Menu from a CSV',
    /** The one hint the file needs: its columns and the words each takes. */
    format: 'Columns: name, type (food, soft drinks or bar), and if they change: on offer (yes or no), diet (veg, egg or non-veg), description.',
    choose: 'Choose a CSV',
    chooseAnother: 'Choose another CSV',
    /** A line of the preview: `Club sandwich · Food · On offer`, or without on offer when the file leaves it as it is. */
    item: '{name} · {kind} · {offer}',
    itemOnly: '{name} · {kind}',
    problems: {
      name: 'Line {line}: give a name of 1 to 60 characters.',
      type: 'Line {line}: use food, soft drinks or bar as the type.',
      onOffer: 'Line {line}: write yes, no or nothing under on offer.',
      diet: 'Line {line}: write veg, egg, non-veg or nothing under diet.',
      description: 'Line {line}: keep the description to 140 characters.',
      twice: 'Line {line}: {name} is listed twice.',
    },
    columns: 'Name the columns on the first line: name and type.',
    empty: 'No items in that file.',
    tooMany: 'Over 300 items. Split the file.',
    unreadable: 'Not read. Choose a CSV file.',
    tooBig: 'Over 1 MB. Choose the menu’s CSV.',
    save: 'Save items',
    saved: '{count} items saved to the menu.',
    savedOne: '1 item saved to the menu.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      invalid: 'Not saved. Check the file and choose it again.',
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'Not sent. Try again.',
    },
  },
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
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'The import did not go through. Try again.',
    },
  },
} as const;
