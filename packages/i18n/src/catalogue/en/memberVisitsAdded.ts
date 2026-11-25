/**
 * Visits added by hand and from a file (the owner, 25 Nov): on a member's Visits, the floor and up add a past one, which
 * counts at once for a super admin and waits for one otherwise; a super admin edits a visit there too, adds visits from a
 * file on Members, and approves or refuses the waiting ones under Promotions. `{date}` is `20 Nov 2026`, `{from}` `20:00`.
 */
export const memberVisitsAdded = {
  add: 'Add visit',
  /** The form's name, for a screen reader. */
  addTitle: 'Add a past visit',
  night: 'Club night',
  /** Under the date: a time after midnight is the night before's, as the club day runs 06:00 to 06:00. */
  nightHint: 'A time after midnight belongs to this night.',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  table: 'Table',
  reason: 'Reason',
  reasonHint: '3 to 200 characters.',
  save: 'Save visit',
  badTimes: 'Check-out must be after check-in.',
  pickTable: 'Pick a table.',
  /** What an add did: a super admin's counts at once; anyone else's waits. */
  done: {
    added: 'Visit added.',
    waiting: 'Sent to a super admin to approve.',
    refused: 'A super admin refused this visit.',
  },
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    own_record: 'Not on your own record.',
    no_member: 'No such member.',
    no_table: 'No such table.',
    invalid: 'Give a reason of 3 to 200 characters, on one line.',
    times: 'Check-out must be after check-in, and not after now.',
    club_day: 'Check-out must be by 06:00 after the club night.',
    clash: 'This overlaps another visit of theirs.',
    paused: 'Frozen, or promotions stopped. Nothing saved.',
    busy: 'Too many at once. Try again shortly.',
    decided: 'Already decided by another super admin.',
    unavailable: 'Not saved. Try again.',
  },
  /** An add not yet counted, above the visits. */
  waitingLine: '{date} · {from} to {to} · {table} · Waiting for approval',
  refusedLine: '{date} · {from} to {to} · {table} · Refused: {why}',
  edit: 'Edit',
  editNamed: 'Edit the visit of {date}',
  editSubtitle: '{name} · {date}',
  /** Visits from a file, for super admins on Members. */
  file: {
    open: 'Visits from a file',
    format: 'A CSV or Excel (.xlsx) file. Columns: member (number or mobile), date (the club night, 2026‑11‑20), check-in and check-out (20:00), table (its name) and reason.',
    choose: 'Choose a file',
    chooseAnother: 'Choose another file',
    /** A line of the preview: `Line 2 · Ritika Das · No. 1042 · 20 Nov 2026 · 20:00 to 23:30 · Table 5 · From the register`. */
    line: 'Line {line} · {name} · No. {number} · {date} · {from} to {to} · {table} · {reason}',
    problems: {
      member: 'Line {line}: give a member number or a 10-digit mobile.',
      night: 'Line {line}: give the date as 2026-11-20 and times as 20:00, check-out after check-in.',
      table: 'Line {line}: give the name of the table.',
      reason: 'Line {line}: give a reason of 3 to 200 characters, on one line.',
      unknown: 'Line {line}: no member has that number or mobile.',
      unknownTable: 'Line {line}: no table has that name.',
      own: 'Line {line}: your own record. Ask another super admin.',
    },
    columns: 'Name the columns on the first line: member, date, check-in, check-out, table and reason.',
    empty: 'No lines in that file.',
    tooMany: 'Over 500 lines. Split the file.',
    unreadable: 'Not read. Choose a CSV or .xlsx file.',
    tooBig: 'Over 1 MB, or past 5,000 rows. Choose a smaller file.',
    totals: '{count} visits',
    totalsOne: '1 visit',
    toFix: 'Fix {count} lines, then choose another file.',
    toFixOne: 'Fix 1 line, then choose another file.',
    save: 'Add every visit',
    saving: 'Saving. This stays open until it is done.',
    confirm: 'Yes, add {count} visits',
    confirmOne: 'Yes, add 1 visit',
    saved: '{count} visits added.',
    savedOne: '1 visit added.',
    atLine: 'Refused at line {line}. {why}',
  },
  /** Visits waiting for a super admin, under Promotions. */
  approvals: {
    label: 'Visits waiting for approval',
    none: 'No visits waiting.',
    /** `Ritika Das · No. 1042 · 20 Nov 2026 · 20:00 to 23:30 · Table 5`. */
    line: '{name} · No. {number} · {date} · {from} to {to} · {table}',
    why: '{reason} · asked by {who}',
    approve: 'Approve',
    approveNamed: 'Approve: {name}',
    confirmApprove: 'Yes, approve',
    refuse: 'Refuse',
    refuseNamed: 'Refuse: {name}',
    refusal: 'Why it is refused',
    confirmRefuse: 'Refuse visit',
    approved: 'Visit of {name} approved.',
    refused: 'Visit of {name} refused.',
  },
};
