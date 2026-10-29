/**
 * The catalogue of member-facing feature keys (docs/spec/additions-2026-10-14.md,
 * "Tier-gated features"). Admins decide in the console which tiers get each gateable
 * feature; the database checks it with `has_feature(member_id, key)` and the apps with
 * `useFeature(key)`. A migration keeps the `feature` table equal to this list (a db test
 * enforces it). Lanes add a key here for every new member-facing feature.
 *
 * Licensed Learn sources add one key each at upload time (`learn.source.<id>`); those
 * live only in the database.
 */

/** One feature in the catalogue. */
export interface FeatureDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** Screens or entry points the feature controls, for the console's Tiers screen. */
  readonly screens: readonly string[];
  /** Core features are never gated: gating them would lock a member out of their account or money. */
  readonly isGateable: boolean;
}

const gateable = (key: string, name: string, description: string, screens: string[]): FeatureDefinition => ({
  key, name, description, screens, isGateable: true,
});

const core = (key: string, name: string, description: string, screens: string[]): FeatureDefinition => ({
  key, name, description, screens, isGateable: false,
});

/** Every feature key declared in code. */
export const FEATURES = [
  gateable('learn.library', 'Learn library', 'The Learn tab and its library of sources.', ['player:learn']),
  gateable('learn.drills', 'Drills', 'Drill sessions, verdicts and summaries.', ['player:learn/drill']),
  gateable('learn.review', 'Learn review', 'The review heatmap of past drill answers.', ['player:learn/review']),
  gateable('learn.academy_lessons', 'Academy lessons', 'RIVR Academy Level 1 to 3 lessons and quizzes.', ['player:learn/academy']),
  gateable('sessions.history', 'Session history', 'Past sessions with buy-in, cash-out, net and receipts.', ['player:sessions']),
  gateable('balance.deposits', 'Deposits', 'UPI deposit details and UTR entry.', ['player:balance/deposit']),
  gateable('rewards.catalogue', 'Rewards catalogue', 'Redeeming points for seats, upgrades and merchandise.', ['player:rewards/catalogue']),
  gateable('rewards.points_history', 'Points history', 'The movements on a member’s points ledger.', ['player:rewards/points']),
  gateable('rewards.accommodation', 'Hotel nights', 'Hotel nights earned by the hours played, at stakes with an hours-per-night rate.', ['player:rewards']),
  gateable('rewards.rakeback', 'Hourly rakeback', 'Bonus each Monday on a member’s share of last week’s rake, at stakes with a rakeback rate.', []),
  gateable('league.standings', 'League', 'RIVR League standings and season.', ['player:rewards/league']),
  gateable('referral.share_cards', 'Referral and share cards', 'Referral code and rendered share cards.', ['player:rewards/referral']),
  gateable('cab.requests', 'Cab requests', 'Pickup and drop requests when eligible.', ['player:rewards/cab']),
  gateable('events.book', 'Events', 'The events calendar: pro nights, corporate tables and Academy batches, booked from the app.', ['player:events']),
  gateable('social.winner_cards', 'Winner cards', 'Cards celebrating a member’s wins, posted on the club’s social only while they share them.', ['player:profile']),
  gateable('waitlist.join', 'Join waitlist from the app', 'Joining a waitlist before arrival.', ['player:home']),
  gateable('call_time.view', 'Call-time view', 'Time remaining before the member may leave the game.', ['player:home']),
  gateable('table.top_up', 'Top-up requests', 'Asking the floor for more chips from the seat.', ['player:home']),
  core('table.leave', 'Leave the seat', 'Leaving the seat from the app.', ['player:home']),
  gateable('tournaments.register', 'Tournament registration', 'Registering and re-entering from the app.', ['player:home/tournament']),
  gateable('promotions.feed', 'Promotions feed', 'Promotion cards on Home.', ['player:home']),
  gateable('floor.live_view', 'Live floor view', 'Tables running, open seats and waitlist lengths.', ['player:home']),
  gateable('fnb.table_side', 'Table-side food and drink', 'Ordering food and drink from the table.', ['player:home/fnb']),
  gateable('academy.booking', 'Academy booking', 'Booking and paying for an Academy batch.', ['player:learn/academy', 'web:academy']),
  gateable('push.seat_ready', 'Seat-ready notifications', 'Push when a seat is ready.', ['player:profile/notifications']),
  gateable('push.call_time_complete', 'Call-time notifications', 'Push when call time is complete.', ['player:profile/notifications']),
  gateable('push.withdrawal_sent', 'Withdrawal notifications', 'Push when a withdrawal is sent.', ['player:profile/notifications']),
  gateable('push.tournament_starting', 'Tournament notifications', 'Push when a tournament is starting.', ['player:profile/notifications']),
  gateable('push.promotion_published', 'Promotion notifications', 'Push when a promotion is published.', ['player:profile/notifications']),
  core('core.sign_in', 'Sign-in', 'Mobile number and one-time code.', ['player:sign-in']),
  core('core.kyc', 'KYC', 'Identity verification.', ['player:kyc']),
  core('core.profile', 'Profile', 'KYC status, preferences.', ['player:profile']),
  core('core.limits', 'Limits and self-exclusion', 'Member-set limits, cool-off and self-exclusion.', ['player:profile']),
  core('core.notification_settings', 'Notification settings', 'Choosing which notifications to receive.', ['player:profile/notifications']),
  core('core.membership_card', 'Membership card', 'The digital card with its rotating QR.', ['player:card']),
  core('core.balance_view', 'Balance', 'Cash, bonus, markers and movements.', ['player:balance']),
  core('core.withdrawals', 'Withdrawals', 'Withdrawing an existing balance.', ['player:balance/withdraw']),
  core('core.kill_switch_banner', 'Kill-switch banner', 'The banner shown while the venue is frozen.', ['player:*']),
  core('core.house_rules', 'House rules', 'The club’s house rules.', ['player:profile/rules', 'web:house-rules']),
  core('core.feedback', 'Feedback', 'Rating a visit, and sending the club a note.', ['player:home', 'player:profile']),
] as const satisfies readonly FeatureDefinition[];

/** A feature key declared in code. */
export type FeatureKey = (typeof FEATURES)[number]['key'];

/** The key of a licensed Learn source, added at upload. */
export type LearnSourceFeatureKey = `learn.source.${string}`;

/**
 * The player app's tabs a feature gates, for the app's tab bar and the console's preview of a tier (#32):
 * Sessions and Learn follow their feature; Home, Balance and Rewards always show.
 */
export const TAB_FEATURES = { sessions: 'sessions.history', learn: 'learn.library' } as const satisfies Readonly<Record<string, FeatureKey>>;

