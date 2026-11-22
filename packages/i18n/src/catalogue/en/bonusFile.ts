/**
 * Bonus added and used from a file (the owner, 22 Nov), for super admins on Members: the file's columns, each line as it
 * will save or what is wrong with it, and why the file did not save. `{line}` is the file's line; `{chips}` is `2,000`.
 */
export const bonusFile = {
  open: 'Bonus from a file',
  /** The one hint the file needs: its columns and the words each takes. */
  format: 'A CSV or Excel (.xlsx) file. Columns: member (number or mobile), type (add or use), chips (whole fifties) and reason. Members see the reason for an Add.',
  choose: 'Choose a file',
  chooseAnother: 'Choose another file',
  /** A line of the preview: `Line 2 · Ritika Das · No. 1042 · Add 2,000 · Diwali gift`. */
  add: 'Line {line} · {name} · No. {number} · Add {chips} · {reason}',
  use: 'Line {line} · {name} · No. {number} · Use {chips} · {reason}',
  problems: {
    member: 'Line {line}: give a member number or a 10-digit mobile.',
    type: 'Line {line}: write add or use under type.',
    chips: 'Line {line}: give whole fifties from 50 to 1,00,000.',
    reason: 'Line {line}: give a reason of 3 to 200 characters, on one line.',
    unknown: 'Line {line}: no member has that number or mobile.',
    own: 'Line {line}: your own record. Ask another super admin.',
    frozen: 'Line {line}: {name} is frozen.',
    /** Some Bonus is owed: an Add above the line pays it first. */
    owed: 'Line {line}: {name} owes Bonus. Add Bonus above this line first.',
    /** More than the member holds by this line, Adds above it included. */
    short: 'Line {line}: more than {name} holds by then.',
  },
  columns: 'Name the columns on the first line: member, type, chips and reason.',
  empty: 'No lines in that file.',
  tooMany: 'Over 500 lines. Split the file.',
  unreadable: 'Not read. Choose a CSV or .xlsx file.',
  tooBig: 'Over 1 MB, or past 5,000 rows. Choose a smaller file.',
  /** `12 lines · 24,000 added · 3,500 used`. */
  totals: '{count} lines · {added} added · {used} used',
  totalsOne: '1 line · {added} added · {used} used',
  /** Above the wrong lines, shown alone while there are any: the one message announced for all of them. */
  toFix: 'Fix {count} lines, then choose another file.',
  toFixOne: 'Fix 1 line, then choose another file.',
  save: 'Save every line',
  /** Beside Save while a file saves: the sheet stays open until it is answered. */
  saving: 'Saving. This stays open until it is done.',
  /** Beside Save for a file sent before with no answer: Save sends it under the same request, so it can only go once. */
  resend: 'Sent with no answer. Save again.',
  confirm: 'Yes, save {count} lines',
  confirmOne: 'Yes, save 1 line',
  saved: '{count} lines saved.',
  savedOne: '1 line saved.',
  /** A refusal that names a line: `Refused at line 4. More than their Bonus, or some owed. Nothing saved.` */
  atLine: 'Refused at line {line}. {why}',
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    own_record: 'Your own record. Nothing saved.',
    invalid_chips: 'Give whole fifties from 50 to 1,00,000. Nothing saved.',
    invalid: 'Not taken. Nothing saved. Check the file and choose it again.',
    bonus_short: 'More than their Bonus, or some owed. Nothing saved.',
    paused: 'Frozen, or promotions stopped. Nothing saved.',
    busy: 'Too many at once. Try again shortly.',
    /** No answer: the same file sent again goes under the same request id, so it never saves twice. */
    unavailable: 'No answer. Save again.',
  },
};
