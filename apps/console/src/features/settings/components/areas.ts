import { SETTINGS, type SettingKey } from '@rivr/contracts/settings';

/** The rules' areas on the Settings screen (#604), in order; then the venue's own details and chips, for super admins. */
export const RULE_AREAS = ['floor', 'rake', 'cage', 'members', 'academy', 'tax', 'compliance', 'system'] as const;
export type RuleArea = (typeof RULE_AREAS)[number];
export const VENUE_AREAS = ['club', 'chips'] as const;

export type SettingsArea = RuleArea | (typeof VENUE_AREAS)[number];

/** Where each setting sits. Every key the contracts declare has an area, or this does not compile. */
const AREA_OF: Readonly<Record<SettingKey, RuleArea>> = {
  'call_time.minutes': 'floor',
  'card.qr_rotation_seconds': 'floor',
  'dealer.rotation_minutes': 'floor',
  'waitlist.hold_minutes': 'floor',
  'waitlist.interest_to_open': 'floor',
  'waitlist.priority_weights': 'floor',
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
  'host.lapse': 'members',
  'league.points': 'members',
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

