import { SETTINGS, type SettingKey } from '@rivr/contracts/settings';

/** The rules' areas on the Settings screen (#604), in order; then the venue's own details and chips, for super admins. */
export const RULE_AREAS = ['floor', 'rake', 'cage', 'members', 'academy', 'tax', 'compliance', 'system'] as const;
export type RuleArea = (typeof RULE_AREAS)[number];
export const VENUE_AREAS = ['club', 'chips'] as const;
/** Notices on members' Home (decision 0298), with the rules for staff with settings.manage. */
export const NOTICE_AREA = 'notices';

export type SettingsArea = RuleArea | (typeof VENUE_AREAS)[number] | typeof NOTICE_AREA;

/**
 * The areas and rules hidden at the owner's word (29 Oct, #626, decision 0284): no rupee, rake or reporting on any
 * console. A rule set before stays in force; it is only not shown. Points are given by hand now (#629), so the
 * hourly rate is hidden with the rules that turn rake or money into points and bonus. The spin wheel's budget shows, in
 * bonus chips and never in rupees (owner, 3 Nov), so the Spin wheel's link to it lands on it.
 */
export const HIDDEN_AREAS: readonly SettingsArea[] = ['rake', 'cage', 'tax', 'compliance', 'academy', 'system', 'chips'];
const HIDDEN_KEYS: readonly string[] = ['points.per_hour', 'points.rewards_rake_share', 'rakeback.rate'];

/** Whether the Settings screen shows a rule. */
export const isShownSetting = (key: string) => !HIDDEN_KEYS.includes(key);

/** Where each setting sits. Every key the contracts declare has an area, or this does not compile. */
const AREA_OF: Readonly<Record<SettingKey, RuleArea>> = {
  'call_time.minutes': 'floor',
  'call_time.add_choices': 'floor',
  'floor.request_targets': 'floor',
  'card.qr_rotation_seconds': 'floor',
  'dealer.rotation_minutes': 'floor',
  'waitlist.hold_minutes': 'floor',
  'waitlist.interest_to_open': 'floor',
  'waitlist.priority_weights': 'floor',
  // Under Settings → Floor, as the floor runs the desk's check (the owner, 5 Nov; decision 0502).
  'kyc.at_the_club': 'floor',
  'rake.config': 'rake',
  'dealer.variance_threshold': 'rake',
  'high_hand.payouts': 'rake',
  'jackpot.drop': 'rake',
  'jackpot.payout': 'rake',
  'jackpot.shares': 'rake',
  'cage.cash_buy_in_limit': 'cage',
  'cage.second_approver_threshold': 'cage',
  'credit.config': 'cage',
  'markers.due_days': 'cage',
  'accommodation.hours_per_night': 'members',
  'cab.minimum_visits': 'members',
  'points.verified_bonus': 'members',
  'points.daily_staff_cap': 'members',
  'host.lapse': 'members',
  'league.points': 'members',
  'league.prizes': 'members',
  'points.per_hour': 'members',
  'points.rewards_rake_share': 'members',
  'rakeback.rate': 'members',
  'reviews.google_url': 'members',
  'spin.budget': 'members',
  'tier.default': 'members',
  'academy.price': 'academy',
  'learn.daily_points_cap': 'academy',
  'learn.session_points': 'academy',
  'academy.gst': 'tax',
  'gst.config': 'tax',
  'tds.config': 'tax',
  'aml.structuring': 'compliance',
  'kyc.minimum_age': 'compliance',
  'reports.unclaimed_days': 'compliance',
  'alert.thresholds': 'system',
  'exports.alert_rows': 'system',
  'exports.archive_recipient': 'system',
  'social.connected_channels': 'system',
};

const isSettingKey = (key: string): key is SettingKey => SETTINGS.some((definition) => definition.key === key);

/** A setting's area; a key only the database knows yet sits under System. */
export function areaOf(key: string): RuleArea {
  return isSettingKey(key) ? AREA_OF[key] : 'system';
}

