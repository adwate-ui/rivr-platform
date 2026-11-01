/** The console's Check-in screen's copy. */

/** The door's Check-in (#72), as in the prototype. */
export const checkIn = {
  title: 'Check-in',
  expected: 'Expected',
  inRoom: 'In the room',
  checkIn: 'Check in',
  /** Check in's name for a screen reader, beside one expected member. */
  checkInMember: 'Check in {name}',
  phone: 'Mobile number',
  /** The field the door's scanner types the membership card's code into (#71). */
  card: 'Membership card',
  checkInByCard: 'Check in by card',
  noneExpected: 'No one expected.',
  noneInRoom: 'No one in the room yet.',
  notAllowed: 'Your role does not check members in or out. The front desk, floor managers and admins do.',
  invalid: 'Enter a 10-digit mobile number.',
  noMember: 'No member has that number. Sign them up first.',
  cardNotCurrent: 'That card code has changed. Ask the member to show their card again.',
  cardInvalid: 'No card code. Scan the member\'s card.',
  /** After a check-in by card or number: the field is empty again, so this says it went through. */
  checkedIn: 'Checked in.',
  /** Check-out at the door (#82): the visit closes, with its hours; points are given by hand (#629). */
  checkOut: 'Check out',
  checkOutMember: 'Check out {name}',
  checkedOut: 'Checked out. Their hours are counted.',
  notInRoom: 'This member is not checked in, so there is no visit to close.',
  callTimeOwed: 'Call time not complete: {time} short. An admin can let them leave early on the Live floor.',
  stillSeated: 'This member is still seated. The floor ends their seat before they check out.',
  checkOutPaused: 'Venue frozen. Try again once it is released.',
  onBreak: 'This member is on a break from play. They cannot be checked in until it ends.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
};
