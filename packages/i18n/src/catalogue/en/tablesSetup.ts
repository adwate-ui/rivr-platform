/**
 * Tables setup (#642; redesign RD-17), for tables.manage: the stakes the club runs and its tables. A stake or a table is
 * made or changed in the panel at the side. No "chips" and no rupee sign but the minimum buy-in's (owner, 15 Nov).
 */
export const tablesSetup = {
  title: 'Tables setup',
  notAllowed: 'Only the super admin sets up tables.',
  stakes: 'Stakes',
  stakesLabel: 'The stakes the club runs',
  stakesEmpty: 'No stakes yet.',
  tables: 'Tables',
  tablesLabel: 'The club’s tables, in floor order',
  tablesEmpty: 'No tables yet.',
  name: 'Name',
  stakeName: 'Stake name',
  tableName: 'Table name',
  blinds: 'Blinds',
  smallBlind: 'Small blind',
  bigBlind: 'Big blind',
  /** Under the blinds, which cannot be filled without it. */
  blindsRule: 'Blinds in whole 50s.',
  /** A compulsory straddle (decision 0299): optional, above the big blind. */
  straddle: 'Straddle',
  straddleOptional: 'Straddle (optional)',
  /** A stake's call time (redesign RD-16): the same value Settings shows; a stake with none is given to no table. */
  callTime: 'Call time',
  /** In place of the field, for staff who set up tables but do not change settings: the setting is not theirs to write. */
  callTimeNotYours: 'Call time: not in your role. Ask an admin.',
  /** A stake's tables, counted: `1 table`, `4 tables`. */
  tablesColumn: 'Tables',
  tablesOne: '1 table',
  tablesMany: '{count} tables',
  /** An empty cell: no straddle, no call time, no tables. */
  none: '–',
  stake: 'Stake',
  seats: 'Seats',
  /** A table's own minimum buy-in (redesign RD-16): the one rupee figure on the console. */
  minBuyIn: 'Minimum buy-in',
  /** Under the minimum buy-in, which cannot be filled without it: a whole ₹50, as every buy-in on the floor is. */
  minBuyInRule: 'In whole 50s.',
  rupee: '₹',
  change: 'Change',
  /** A row's Change button for a screen reader, and the panel's title while it changes that one. */
  changeStake: 'Change stake {name}',
  changeTable: 'Change table {name}',
  newStake: 'New stake',
  newTable: 'New table',
  save: 'Save',
  /** Save pressed on half a form (UI polish audit UI-19). */
  stakeIncomplete: 'Check the name, blinds, straddle and call time.',
  tableIncomplete: 'Check the name, stake and minimum buy-in.',
  /** After a save, as a toast: `{name}` is the stake or table. A new table is closed until the floor opens it. */
  saved: '{name} saved.',
  stakeAdded: '{name} added.',
  tableAdded: '{name} added, closed.',
  /** The tables' status column (decision 0466): `{count}` players seated at an open table. */
  statusColumn: 'Status',
  status: { inactive: 'Inactive · hidden from the floor', closed: 'Closed tonight', open: 'Open · {count} seated' },
  /** A row's further steps, behind its menu; `{name}` the table or stake. */
  open: 'Open',
  close: 'Close',
  opened: '{name} is open.',
  closedNow: '{name} is closed.',
  deactivate: 'Deactivate',
  reactivate: 'Reactivate',
  delete: 'Delete',
  deleteConfirm: 'Yes, delete {name}',
  deleteQuestion: 'Delete {name}? Its history stays.',
  deleteStakeQuestion: 'Delete {name}?',
  more: 'More for {name}',
  /** A step refused before it is sent: `Delete · Players seated`, `Delete · In use`. */
  stepInPlay: '{step} · {why}',
  inPlay: { players_seated: 'Players seated', players_waiting: 'Players waiting' },
  inUse: 'In use',
  deactivated: '{name} deactivated. Its history stays.',
  reactivated: '{name} is back, closed.',
  deleted: '{name} deleted. Its history stays.',
  stakeDeleted: '{name} deleted.',
  /** A stake's delete refused, said under the list, so it names the stake. */
  stakeInUse: '{name} is still used by a table or its history. Not deleted.',
  /** Deactivating, deleting or closing a table in play, refused before it is sent (@rivr/domain tableRetireRefusal). */
  retireRefusals: {
    players_seated: 'Players sit at {name}. Move them first.',
    players_waiting: 'Players wait for {name}. Take them off its list first.',
  },
  failures: {
    invalid: 'Not saved. Check each field.',
    players_seated: 'Move the players off this table before changing its stake.',
    /** Deactivating or deleting a table with players on its waitlist (decision 0466). */
    players_waiting: 'Take the players off this table’s waitlist first.',
    seats_taken: 'More seats are taken. Free them first.',
    /** A table given a stake that has no call time yet (redesign RD-16). */
    stake_without_call_time: 'That stake has no call time. Give it one first.',
    /** A stake a table, or a deleted table's history, still uses (redesign RD-17). */
    stake_in_use: 'A table or its history still uses that stake. Not deleted.',
    not_allowed: 'Only the super admin sets up tables.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not sent. Try again.',
  },
} as const;
