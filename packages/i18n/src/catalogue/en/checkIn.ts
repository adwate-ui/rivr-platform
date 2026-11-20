/** The console's Check-in screen's copy. */

/** The door's Check-in (#72), as in the prototype. */
export const checkIn = {
  title: 'Check-in',
  expected: 'Expected tonight',
  inRoom: 'In the room',
  checkIn: 'Check in',
  /** Check in's name for a screen reader, beside one expected member. */
  checkInMember: 'Check in {name}',
  /** The door's one field (console v3). */
  field: 'Name, mobile or member number',
  unusable: 'Type a name, mobile or member number.',
  noMatch: 'No member matches. Check the spelling or the number.',
  /** A name or number that finds several members: they are listed under the field. */
  several: 'More than one match. Pick one below.',
  /** `{number}` is the member number. */
  memberMeta: 'No. {number} · {tier}',
  memberNumber: 'No. {number}',
  /** The door as one table (redesign RD-30): its name, its chips as a group, the third chip, and its one line when a chip holds nobody. */
  doorLabel: 'At the door today',
  lists: 'List',
  left: 'Left',
  noneOnList: 'No one on this list.',
  notAllowed: 'Not in your role. Ask an admin.',
  noMember: 'No member has that number. Sign them up first.',
  /** After a check-in by number: the field is empty again, so this says it went through. */
  checkedIn: 'Checked in.',
  /** Check-out at the door (#82): the visit closes, with its hours. */
  checkOut: 'Check out',
  checkOutMember: 'Check out {name}',
  /** Bonus used without a seat (the owner, 20 Nov), on a checked-in member's first row: opens the record's form in a sheet. */
  useBonus: 'Use Bonus',
  useBonusMember: 'Use Bonus for {name}',
  checkedOut: 'Checked out.',
  notInRoom: 'Not checked in.',
  callTimeOwed: '{time} call time owed. An admin can release them on the Live floor.',
  /** Owed with no call time set (#1076): the countdown is done, but none was set. */
  callTimeNotSet: 'Call time not set. An admin can release them on the Live floor.',
  stillSeated: 'Still seated. The floor ends the seat first.',
  checkOutPaused: 'Venue frozen. Try again once it is released.',
  onBreak: 'This member is on a break from play. Not checked in.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
};
