/** The console's SOP library (#51): read and acknowledge; for SOP managers, add SOPs, publish versions, see who acknowledged. */
export const sops = {
  title: 'SOPs',
  empty: 'No SOPs yet.',
  /** The version in force: `{date}` is its IST day, `{owner}` a job title. */
  version: 'Version {version}, in force since {date}. Owner: {owner}.',
  /** A later version waiting for its day. */
  waiting: 'Version {version} takes effect on {date}.',
  /** The heading over a later version's text, on an SOP's screen. */
  nextVersion: 'Next version',
  /** `{owner}` is a job title. */
  nextOwner: 'Owner: {owner}.',
  /** `{roles}` lists the roles, such as Dealers and Hosts. */
  roles: 'To be acknowledged by {roles}.',
  noRoles: 'No role must acknowledge it.',
  mustAcknowledge: 'Your role must acknowledge this version.',
  acknowledgedOn: 'You acknowledged this version on {date}.',
  /** For SOP managers: of the staff in the roles it asks. */
  progress: '{count} of {total} staff acknowledged.',
  read: 'Read {title}',
  back: 'Back to SOPs',
  acknowledge: 'Acknowledge',
  /** Staff who manage SOPs. */
  acknowledgements: 'Acknowledgements',
  name: 'Name',
  role: 'Role',
  acknowledgedAt: 'Acknowledged',
  notYet: 'Not yet',
  nobodyAsked: 'Nobody on the staff list is in the roles this version asks.',
  newVersion: 'New version',
  /** The button on the library, and the heading of its form. */
  add: 'Add an SOP',
  newSop: 'New SOP',
  sopTitle: 'Title',
  owner: 'Owner',
  ownerHint: 'The job title that keeps it current, such as Floor manager.',
  ackRoles: 'Roles that must acknowledge it',
  effectiveOn: 'Takes effect on',
  effectiveOnHint: 'Today or later, and not before the last version.',
  body: 'Text',
  bodyHint: 'One step a line, numbered.',
  publish: 'Publish version',
  addSop: 'Add SOP',
  cancel: 'Cancel',
  invalid: 'Something is missing or too long. Give a title of up to 120 characters, an owner of up to 80, the day it takes effect and the text.',
  invalidVersion: 'Something is missing or too long. Give an owner of up to 80 characters, the day it takes effect and the text.',
  /** Staff roles, in the plural, as in "To be acknowledged by Dealers and Hosts". */
  roleNames: {
    super_admin: 'Super admins',
    admin: 'Admins',
    cashier: 'Cashiers',
    dealer: 'Dealers',
    marketing: 'Marketing',
    host: 'Hosts',
    owner_view: 'Owner view',
  },
  notAllowed: 'Your role does not allow this. Ask the general manager.',
  paused: 'The venue is frozen. Try again once it is released.',
  day: 'That day is before today or before the last version\'s. Choose today or a later day.',
  taken: 'The library already has an SOP with this title. Choose another title, or publish a new version of it.',
  changed: 'A newer version is now in force. Read it, then acknowledge it.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
