/** Someone signed in to the console who is not active staff at any venue. */
export const notStaff = {
  title: 'Staff only',
  body: 'This console is for RIVR staff. A manager can add your number to the staff list.',
};

/** The console's Staff screen (#28): the venue's staff, with job titles apart from roles. */
export const staff = {
  title: 'Staff',
  notAllowed: 'Your role does not manage staff. Ask an admin if you need it.',
  empty: 'No staff yet.',
  /** The seven permission roles, as the screen names them. */
  roles: {
    super_admin: 'Super admin',
    admin: 'Admin',
    cashier: 'Cashier',
    dealer: 'Dealer',
    marketing: 'Marketing',
    host: 'Host',
    owner_view: 'Owner, view only',
  },
  /** Under a name: `{jobTitle}`, then the role. */
  line: '{jobTitle} · {role}',
  /** A dealer with no number, who signs in on a tablet with a PIN. */
  noPhone: 'No number',
  inactive: 'Turned off',
  you: 'You',
  /** Accessible name of the role choice on a staff member's row. */
  roleFor: 'Role for {name}',
  activeFor: 'Active: {name}',
  jobTitleFor: 'Job title for {name}',
  saveJobTitle: 'Save job title for {name}',
  /** On the signed-in staff member's own row. */
  ownRow: 'You can change your own job title, but not your role or whether you are active.',
  addTitle: 'New staff member',
  fullName: 'Full name',
  jobTitle: 'Job title',
  jobTitleHint: 'From the manpower plan, for example Floor supervisor. Rosters use it; the role decides access.',
  role: 'Role',
  /** Only the roles the manager may give are offered. */
  roleHint: 'Only roles within your own access are offered.',
  phone: 'Mobile number',
  phoneHint: 'The number they sign in with. Only a dealer, who signs in with a PIN, may have none.',
  add: 'Add staff member',
  added: '{name} is added.',
  invalidName: 'Give their full name.',
  invalidJobTitle: 'Give a job title of up to 60 characters.',
  invalidRole: 'Choose a role.',
  invalidPhone: 'Give their 10-digit mobile number. Only a dealer may have none.',
  notAllowedAction: 'Your role cannot give that role or change that staff member. Ask a super admin.',
  alreadyStaff: 'That number is already on the staff list. Find them below and turn their row back on.',
  ownChange: 'You cannot change your own role or turn yourself off. Ask another manager.',
  lastSuperAdmins: 'That would leave fewer than two super admins able to release a venue freeze. Add another super admin first.',
  jobTitleSaved: 'Job title saved.',
  changed: 'That did not save. Check the details and try again.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
