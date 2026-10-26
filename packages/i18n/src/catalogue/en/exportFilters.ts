/** How a table's export records the screen's own filters in the audit log (#102): `Days: 2026-10-01 to 2026-10-26`. */
export const exportFilters = {
  period: 'Days: {from} to {to}',
  day: 'Day: {day}',
  month: 'Month: {month}',
  /** A chip chosen above a table: `Table: Table 3`. */
  choice: '{label}: {value}',
} as const;
