import type { MemberKycStatus, MemberStaffChange, MemberStaffChangeField } from '@rivr/db';
import { activityActionWord, activityEntityWord, formatChips, formatDate, formatDateTime, formatDuration, formatMobile, staffHistoryFieldWord, t } from '@rivr/i18n';

type Value = MemberStaffChangeField['before'];

const MOMENT = /^\d{4}-\d{2}-\d{2}T/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Fields that hold a code, such as `needs_review`, read as words: `Needs review`. */
const CODED = new Set(['status', 'method', 'decision', 'outcome', 'kind', 'trigger', 'effect', 'end_reason', 'leave_reason', 'left_reason', 'close_reason',
  'level', 'feature', 'purpose', 'pan_recheck']);

/**
 * An ID check's status in the words Members and the Door use for it (UI review of the batch PR): `verified` is Checked,
 * `needs_review` In review. A check only started keeps its own word, as it is Due or Not done by where it was started.
 */
const KYC_WORDS: Readonly<Partial<Record<string, MemberKycStatus>>> = {
  verified: 'verified', needs_review: 'in_review', in_review: 'in_review', at_desk: 'at_desk', refused: 'refused',
};

/** Fields that count chips of ₹1: a Bonus line's, what is owed, and a Bonus file's Add or Use (the owner, 22 Nov). */
const CHIP_FIELDS = new Set(['chips', 'owed_chips', 'added_chips', 'used_chips']);

/** A number by what its field counts: paise, chips, seconds, minutes or hours; anything else as it is. */
function numberWords(field: string, value: number): string {
  if (field.endsWith('_paise')) return formatChips(BigInt(Math.round(value)));
  if (CHIP_FIELDS.has(field)) return formatChips(BigInt(Math.round(value * 100)));
  if (field.endsWith('_seconds')) return formatDuration(value);
  if (field === 'call_time_minutes') return formatDuration(value * 60);
  return field === 'session_reminder_hours' ? formatDuration(value * 3600) : String(value);
}

/** A text: a mobile, a moment or a club day in IST, an ID check's status in Members' words, a code in plain words, or as written. */
function textWords(field: string, value: string, entity: string | undefined): string {
  if (field === 'phone') return formatMobile(value);
  const kyc = entity === 'kyc_record' && field === 'status' ? KYC_WORDS[value] : undefined;
  if (kyc !== undefined) return t(`console.members.kycStatuses.${kyc}`);
  if (MOMENT.test(value)) return formatDateTime(new Date(value));
  if (DAY.test(value)) return formatDate(new Date(`${value}T12:00:00+05:30`));
  if (!CODED.has(field)) return value;
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A field's value in words; null for a list or a set of values, which History does not spell out. */
export function valueWords(field: string, value: Value, entity?: string): string | null {
  if (value === null) return t('console.members.staffHistory.empty');
  if (typeof value === 'boolean') return t(value ? 'console.members.staffHistory.yes' : 'console.members.staffHistory.no');
  if (typeof value === 'number') return numberWords(field, value);
  return typeof value === 'string' ? textWords(field, value, entity) : null;
}

/** What the change was and to what, in the Activity screen's words: `Changed · Seat`, `Reset hours · Member`. */
export function whatWords(change: MemberStaffChange): string {
  return t('console.members.staffHistory.what', { action: activityActionWord(change.action), thing: activityEntityWord(change.entity) });
}

/** One field's change in words; none for a field without words of its own, never its column's name. */
function fieldLine(one: MemberStaffChangeField): string[] {
  const field = staffHistoryFieldWord(one.field);
  if (field === null) return [];
  if (one.isHidden) return [t('console.members.staffHistory.hiddenChange', { field })];
  const before = valueWords(one.field, one.before, one.entity);
  const after = valueWords(one.field, one.after, one.entity);
  return before === null || after === null ? [] : [t('console.members.staffHistory.change', { field, before, after })];
}

/** Each field the change touched, before and after: `Status: Needs review → Verified`; a line said twice is said once. */
export function fieldLines(change: MemberStaffChange): readonly string[] {
  return [...new Set(change.fields.flatMap(fieldLine))];
}
