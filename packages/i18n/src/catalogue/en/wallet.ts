/** The member's Balance (#18; design prompt "Balance"): cash, bonus, points, markers and every movement. */
export const balance = {
  title: 'Balance',
  empty: 'No movements yet.',
  cash: 'Cash',
  /** A bonus grant ending within the week: "₹4,000 bonus · expires Sunday 23:59". */
  bonusLine: '{amount} bonus · expires {day} {time}',
  /** A bonus grant ending later: "₹4,000 bonus · expires Sun 29 Nov, 23:59". */
  bonusLineLater: '{amount} bonus · expires {when}',
  points: '{points} points',
  markers: 'Markers',
  marker: 'Issued {issued} · due {due}',
  noMarkers: 'No open markers.',
  limit: 'Limit {limit} · available {available}',
  movements: 'Movements',
  showEarlier: 'Show earlier movements',
  /** A movement with where it happened or why: "Cash-out · Table 2", "Bonus · Referral". */
  movementAt: '{title} · {detail}',
  /** What each kind of movement is called. */
  kindBuyIn: 'Buy-in',
  kindCashOut: 'Cash-out',
  kindMarker: 'Marker',
  kindBonus: 'Bonus',
  kindBonusExpiry: 'Bonus expired',
  kindReversal: 'Correction',
  kindOpeningBalance: 'Opening balance',
  kindOther: 'Club entry',
  /** After a bonus movement's amount: "+₹4,000 bonus". */
  bonusWord: 'bonus',
  /** A marker line: more owed on markers, or some of it repaid. */
  owed: '{amount} owed',
  repaid: '{amount} repaid',
};
