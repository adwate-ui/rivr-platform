/** Someone signed in to the console who is not active staff at any venue. */
export const notStaff = {
  title: 'Staff only',
  body: 'For RIVR staff. Ask a manager to add your number.',
};

/** The console's Staff screen (#28): the venue's staff, with job titles apart from roles. */
export const staff = {
  title: 'Staff',
  /** The tabs (#606); Dealer PINs takes its own title. */
  tabs: { staff: 'Staff members' },
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No staff yet.',
  /** The staff table (C-03): its headings and search, the button that opens the add form, and a row's Close (common.close). */
  name: 'Name',
  login: 'Login',
  active: 'Active',
  search: 'Find staff',
  /** The role filter (console v3): All, then each role someone holds; it is named by `role`. */
  allRoles: 'All',
  addOpen: 'Add staff',
  closeFor: 'Close {name}',
  /** The permission roles, as the screen names them. */
  roles: {
    super_admin: 'Super admin',
    admin: 'Admin',
    floor: 'Floor',
    cashier: 'Cashier',
    dealer: 'Dealer',
    marketing: 'Marketing',
    host: 'Host',
    owner_view: 'Owner, view only',
    service: 'Service',
  },
  /** Under a name: `{jobTitle}`, then the role. */
  line: '{jobTitle} · {role}',
  /** A dealer with no number, who signs in on a tablet with a PIN. */
  noPhone: 'No number',
  inactive: 'Turned off',
  you: 'You',
  /** A row's way into its changes (UI polish audit A-17), and out again. */
  change: 'Change',
  changeFor: 'Change {name}',
  done: 'Done',
  /** Accessible name of the role choice on a staff member's row. */
  roleFor: 'Role for {name}',
  activeFor: 'Active: {name}',
  /** A role or active change picked on a row is asked before it is saved (F1-09). */
  askRole: 'Change {name}\'s role to {role}?',
  confirmRole: 'Yes, change it',
  askTurnOff: 'Turn off {name}\'s login?',
  confirmTurnOff: 'Yes, turn it off',
  askTurnOn: 'Turn {name}\'s login back on?',
  confirmTurnOn: 'Yes, turn it on',
  jobTitleFor: 'Job title for {name}',
  saveJobTitle: 'Save job title for {name}',
  /** On the signed-in staff member's own row. */
  ownRow: 'Your own row: job title only.',
  addTitle: 'New staff member',
  fullName: 'Full name',
  jobTitle: 'Job title',
  jobTitleHint: 'For example, Floor supervisor.',
  role: 'Role',
  /** Only the roles the manager may give are offered. */
  roleHint: 'Roles within your access.',
  phone: 'Mobile number',
  phoneHint: 'Their sign-in number. Dealers may have none.',
  add: 'Add staff member',
  added: '{name} is added.',
  invalidName: 'Give their full name.',
  invalidJobTitle: 'Give a job title of up to 60 characters.',
  invalidRole: 'Choose a role.',
  invalidPhone: 'Give a 10-digit mobile. Only dealers may have none.',
  notAllowedAction: 'Beyond your role. Ask a super admin.',
  alreadyStaff: 'Already on the staff list. Turn their row back on below.',
  ownChange: 'You cannot change your own role or turn yourself off. Ask another manager.',
  lastSuperAdmins: 'Two super admins must stay. Add another first.',
  paused: 'Venue frozen. Only turning a login off works until release.',
  jobTitleSaved: 'Job title saved.',
  changed: 'Not saved. Check the details.',
  unavailable: 'Not sent. Try again.',
  /** A hire's onboarding checklist (#107): each SOP in force that asks their role, ticked once they acknowledge that version. */
  onboarding: {
    progress: 'Onboarding: {count} of {total} SOPs acknowledged.',
    none: 'No SOP in force asks this role.',
    show: 'Onboarding checklist for {name}',
    hide: 'Hide onboarding checklist for {name}',
    sop: 'SOP',
    version: 'Version',
    acknowledged: 'Acknowledged',
    notYet: 'Not yet',
  },
};
