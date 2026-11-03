/** The console's Check-in screen's copy. */

/** The door's Check-in (#72), as in the prototype. */
export const checkIn = {
  title: 'Check-in',
  /** The Door's tabs (console v3): Check-in and Today's players. */
  door: 'Door',
  expected: 'Expected tonight',
  inRoom: 'In the room',
  checkIn: 'Check in',
  /** Check in's name for a screen reader, beside one expected member. */
  checkInMember: 'Check in {name}',
  /** The door's one field (console v3): the scanner types a membership card's code into it (#71), or staff type. */
  field: 'Card, mobile, number or name',
  unusable: 'Scan the card, or type a mobile, member number or name.',
  noMatch: 'No member matches. Check the spelling or the number.',
  /** A name or number that finds several members: they are listed under the field. */
  several: 'More than one match. Pick one below.',
  /** `{number}` is the member number. */
  memberMeta: 'No. {number} · {tier}',
  /** Check out pressed on a scanned card: the door checks out by number or from the list. */
  cardCheckOut: 'Check them out from In the room.',
  noneExpected: 'No one expected.',
  noneInRoom: 'No one in the room yet.',
  notAllowed: 'Not in your role. Ask the front desk.',
  noMember: 'No member has that number. Sign them up first.',
  cardNotCurrent: 'Code changed. Ask them to show the card again.',
  /** After a check-in by card or number: the field is empty again, so this says it went through. */
  checkedIn: 'Checked in.',
  /** Check-out at the door (#82): the visit closes, with its hours; points are given by hand (#629). */
  checkOut: 'Check out',
  checkOutMember: 'Check out {name}',
  checkedOut: 'Checked out.',
  notInRoom: 'Not checked in.',
  callTimeOwed: '{time} of call time owed. An admin can release them on the Live floor.',
  stillSeated: 'Still seated. The floor ends the seat first.',
  checkOutPaused: 'Venue frozen. Try again once it is released.',
  onBreak: 'On a break. Check-in is closed until it ends.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
};
