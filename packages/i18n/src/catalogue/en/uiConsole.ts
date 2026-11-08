/**
 * Copy that @rivr/ui's console v3 components show themselves (decision 0465): the shell, its search, sheets, the floor's
 * tiles and rows, and the controls the console's screens share. Read as `ui.console.*`.
 */
export const consoleUi = {
  shell: {
    /** The rail's foot: fold it to icons, or open it to its labels again. Remembered on the device. */
    collapse: 'Collapse',
    expand: 'Expand',
    /** Below 768 px, the bar of tabs at the foot of the screen, and its last tab, which opens every screen. */
    tabs: 'Main',
    more: 'More',
    moreTitle: 'All screens',
    closeMore: 'Close',
  },
  /** The header's search, which opens the command palette (`/` or Ctrl K). */
  palette: {
    trigger: 'Search members, screens, actions',
    /** The trigger's key, shown at its end. */
    key: '/',
    label: 'Search',
    placeholder: 'Type a name, member no., screen or action',
  },
  sheet: {
    close: 'Close',
  },
  /** A panel docked beside a screen (the Live floor's requests): fold it to a strip, or open it again from the strip. */
  dockedPanel: {
    fold: 'Collapse',
    open: 'Open, {count} waiting',
  },
  /** The staff member's menu at the header's end (AccountMenu): the heading over the keys that work. */
  account: {
    shortcuts: 'Shortcuts',
    /** The account button's name: the initials it shows, then whose they are (WCAG 2.5.3). `AM, Aditya Malhotra`. */
    button: '{initials}, {name}',
  },
  /** A practice venue's stripe across the top of the console (PracticeBanner): read as the region's name. */
  practice: {
    label: 'Practice venue',
  },
  /** A control's tooltip with the key that does the same (useShortcut): "Seat a player (S)". */
  shortcuts: {
    withKey: '{label} ({key})',
  },
  /** DataTable's ticks: each row's, read with the row's title (`Select Arjun Mehta`), and the header's for every row as shown. */
  dataTable: {
    selectRow: 'Select {row}',
    selectAll: 'Select all',
  },
  /** A table on the live floor. */
  tableTile: {
    settings: 'Settings for {table}',
    seated: '{seated} of {total} seated',
    needsYouOne: '1 needs you',
    needsYou: '{count} need you',
    showSeats: 'Show seats',
    hideSeats: 'Hide seats',
    closed: 'Closed',
    /** The seat bar, read out: `6 seated, 2 need you, 1 open`. */
    bar: '{seated} seated, {needs} need you, {open} open',
  },
  seatRow: {
    seat: 'Seat {number}',
    open: 'Open',
  },
  requestItem: {
    /** An age past its target, shown in words before the danger colour (WCAG 1.4.1): `Late · 130 min`. */
    late: 'Late · {age}',
  },
  /** ChoiceChips: a chip's count, read with its label as the chip's name: `Pending, 3`. */
  choiceChips: {
    withCount: '{label}, {count}',
  },
  /** The bar over a list while rows are ticked (BulkBar). */
  bulkBar: {
    /** Names the bar for a screen reader. */
    label: 'Selected rows',
    selected: '{count} selected',
    clear: 'Clear',
  },
} as const;
