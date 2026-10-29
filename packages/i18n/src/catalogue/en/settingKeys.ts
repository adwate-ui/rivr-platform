/**
 * Each setting as staff read it on the Settings screen (#604): its name, one line on what it does, each field's label,
 * and a choice field's options. Keyed by the setting's key. The console's catalogue test holds it to every key and
 * field the contracts declare, so a new key cannot ship without its words.
 */
export interface SettingCopy {
  readonly name: string;
  readonly help: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly options?: Readonly<Record<string, string>>;
}

export const settingKeys: Readonly<Record<string, SettingCopy>> = {
  'academy.gst': {
    name: 'GST on Academy fees',
    help: 'The GST taken out of each Academy fee. It is kept apart from GST on club services, as training may be taxed differently.',
    fields: { rate_basis_points: 'Rate' },
  },
  'academy.price': {
    name: 'Academy fees',
    help: 'What an Academy seat costs: for one person, and for each person on a corporate booking.',
    fields: { individual_paise: 'One person', corporate_per_head_paise: 'Each person, corporate' },
  },
  'accommodation.hours_per_night': {
    name: 'Hotel night per hours played',
    help: 'The hours played at this table type that earn one hotel night. Not set earns none.',
    fields: { hours: 'Hours played' },
  },
  'alert.thresholds': {
    name: 'Delivery failure alert',
    help: 'The owner is alerted when this many messages fail for good within this many minutes. 5 within 60 minutes unless set.',
    fields: { failed_deliveries: 'Failed messages', window_minutes: 'Within' },
  },
  'aml.structuring': {
    name: 'Structuring pattern',
    help: 'Flags a member whose cash buy-ins end just under the limit this many times within this many days. 3 in 7 days, within 10%, unless set.',
    fields: { count: 'Times', window_days: 'Within', margin_basis_points: 'Under the limit by up to' },
  },
  'cab.minimum_visits': {
    name: 'Cab offer after',
    help: 'The visits a member needs this month before the app offers them a cab. 4 unless set.',
    fields: { visits: 'Visits this month' },
  },
  'cage.cash_buy_in_limit': {
    name: 'Cash buy-in limits',
    help: 'The most a member may buy in for cash in one visit and in one club day. A cash buy-in past either is refused.',
    fields: { per_visit_paise: 'Per visit', per_day_paise: 'Per club day' },
  },
  'cage.second_approver_threshold': {
    name: 'Second approval from',
    help: 'A withdrawal of this much or more is paid only once a second staff member approves it. A raise takes effect 24 hours after it is made.',
    fields: { threshold_paise: 'Amount' },
  },
  'call_time.minutes': {
    name: 'Call time',
    help: 'How long a player must play at this table type after being seated before leaving.',
    fields: { minutes: 'Minutes' },
  },
  'card.qr_rotation_seconds': {
    name: 'Door code refresh',
    help: "How often the membership card's code changes. An older code no longer checks in. Every 30 seconds unless set.",
    fields: { seconds: 'Every' },
  },
  'credit.config': {
    name: 'Credit lines',
    help: 'Who may get credit, and how much: the visits a member needs first, the limit above which a super admin approves, and the most the room may owe in all. A raise of the approval limit takes effect 24 hours after it is made.',
    fields: { minimum_visits: 'Visits needed', approval_threshold_paise: 'Super admin approves above', exposure_cap_paise: 'Most owed in all' },
  },
  'dealer.rotation_minutes': {
    name: 'Dealer rotation',
    help: 'How long a dealer deals at one table before the floor rotates them. 30 minutes unless set.',
    fields: { minutes: 'Minutes' },
  },
  'dealer.variance_threshold': {
    name: 'Drop-box variance alert',
    help: "How far a down's drop-box count may differ from the rake and jackpot drops in its hands, either way, before an alert. Not set alerts on any difference.",
    fields: { threshold_paise: 'Difference' },
  },
  'exports.alert_rows': {
    name: 'Large export alert',
    help: 'An export of this many rows or more alerts the owner. 1,000 unless set.',
    fields: { rows: 'Rows' },
  },
  'exports.archive_recipient': {
    name: 'Archive encryption key',
    help: "The public key a full export archive is encrypted to: the owner's backup key. No archive is made until it is set.",
    fields: { recipient: 'Public key' },
  },
  'gst.config': {
    name: 'GST on club services',
    help: 'The GST taken out of what the club collects, and what it is charged on.',
    fields: { rate_basis_points: 'Rate', basis: 'Charged on' },
    options: { rake: 'The rake', table_fee: 'A table fee' },
  },
  'high_hand.payouts': {
    name: 'High-hand prizes',
    help: 'What each high hand pays. 0 pays nothing.',
    fields: { royal_flush: 'Royal flush', straight_flush: 'Straight flush', four_of_a_kind: 'Four of a kind' },
  },
  'host.lapse': {
    name: 'Lapsed regular',
    help: 'A regular goes to the host queue after this many visits in six months, then none for this many days. 3 visits and 21 days unless set.',
    fields: { visits: 'Visits in six months', days: 'Then away for' },
  },
  'jackpot.drop': {
    name: 'Jackpot drop',
    help: 'What every pot above a size drops into the bad-beat jackpot while it is live.',
    fields: { drop_paise: 'Drop', above_paise: 'From pots above' },
  },
  'jackpot.payout': {
    name: 'Bad-beat payout',
    help: 'The share of the main pool a bad beat pays, and how it splits between the loser, the winner and the others dealt in, which together make 100%.',
    fields: { pool_basis_points: 'Of the main pool', loser_basis_points: 'Loser', winner_basis_points: 'Winner', table_basis_points: 'Others dealt in' },
  },
  'jackpot.shares': {
    name: 'Jackpot pool shares',
    help: 'The parts of every jackpot drop kept for the season and freeroll pools, up to 50% each. The main pool takes the rest.',
    fields: { season_basis_points: 'Season pool', freeroll_basis_points: 'Freeroll pool' },
  },
  'kyc.minimum_age': {
    name: 'Minimum age',
    help: 'The age a member must have reached to be verified and to play. Never below 18.',
    fields: { years: 'Age' },
  },
  'league.points': {
    name: 'League points',
    help: 'RIVR League points for a tournament finish: every finisher earns the entry points, and more for first, second, third and the rest of the final table.',
    fields: { entry: 'Taking part', first: 'First', second: 'Second', third: 'Third', final_table: 'Rest of the final table' },
  },
  'league.prizes': {
    name: 'League prizes',
    help: "The RIVR League's prizes, in words, as the website's Leaderboard shows them: this month's and this season's. Not set shows none.",
    fields: { month: 'This month', season: 'This season' },
  },
  'learn.daily_points_cap': {
    name: 'Learn points, daily cap',
    help: 'The most Learn points a member earns in a day, so drilling again cannot farm them. 100 unless set.',
    fields: { points: 'Points' },
  },
  'learn.session_points': {
    name: 'Learn points',
    help: 'Learn points for a finished drill session, and for each principle mastered the first time. 10 and 25 unless set.',
    fields: { per_session: 'Per session', per_principle: 'Per principle mastered' },
  },
  'markers.due_days': {
    name: 'Marker due after',
    help: 'How long after it is issued a marker falls due. A member with a marker past due gets no new credit.',
    fields: { days: 'Days' },
  },
  'points.per_hour': {
    name: 'Points per hour',
    help: 'The points a member earns for each hour played at this table type. Not set earns none.',
    fields: { points: 'Points' },
  },
  'points.rewards_rake_share': {
    name: 'Points from rake',
    help: "The share of a member's rake they earn back as points, one a rupee. Not set earns none.",
    fields: { basis_points: 'Share' },
  },
  'rake.config': {
    name: 'Rake',
    help: 'The rake taken from each pot at this table type, and its cap. Rake and jackpot changes start at least a minute from now.',
    fields: { rate_basis_points: 'Rate', cap_paise: 'Cap' },
  },
  'rakeback.rate': {
    name: 'Rakeback',
    help: "The share of a member's rake at this table type over a club week, given back as bonus each Monday, held to a cap and lasting the days given. Not set gives none.",
    fields: { basis_points: 'Share', cap_paise: 'Cap', expires_days: 'Bonus lasts' },
  },
  'reports.unclaimed_days': {
    name: 'Unclaimed balance after',
    help: 'A balance is unclaimed after this long with no money moved and no visit. 365 days unless set.',
    fields: { days: 'Days' },
  },
  'reviews.google_url': {
    name: 'Google review link',
    help: "The club's Google review link, sent once to each member after their third visit. Not set asks for none.",
    fields: { url: 'Link' },
  },
  'social.connected_channels': {
    name: 'Connected social channels',
    help: 'The channels whose secrets are set. A post goes out on these by itself; the others offer it to download and post.',
    fields: { channels: 'Channels' },
    options: {
      instagram: 'Instagram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', telegram: 'Telegram',
      google_business_profile: 'Google Business Profile', whatsapp: 'WhatsApp',
    },
  },
  'spin.budget': {
    name: 'Spin wheel budget',
    help: 'The most bonus the spin wheel gives in a club month. A prize larger than what is left is off the wheel. Not set gives no bonus prizes.',
    fields: { monthly_paise: 'Each month' },
  },
  'tds.config': {
    name: 'TDS on winnings',
    help: 'Whether TDS is taken from winnings (while off, every cash-out still records it), under which section, at what rate, above what net winnings and over what period, and the rate for a member with no PAN.',
    fields: {
      enabled: 'Take TDS', section: 'Section', rate_basis_points: 'Rate', threshold_paise: 'Net winnings above', basis: 'Counted over',
      pan_required: 'PAN needed', no_pan_rate_basis_points: 'Rate without a PAN',
    },
    options: { session: 'Each session', day: 'Each club day', financial_year: 'The financial year' },
  },
  'tier.default': {
    name: 'Starting tier',
    help: 'The tier every new member starts in.',
    fields: { tier_id: 'Tier' },
  },
  'waitlist.hold_minutes': {
    name: 'Seat hold',
    help: 'How long a called seat is held, and how long a member who steps away keeps their place.',
    fields: { minutes: 'Minutes' },
  },
  'waitlist.interest_to_open': {
    name: 'Open a game at',
    help: 'How many members waiting for a game with no open table tell the floor to open one. Not set never tells.',
    fields: { players: 'Players waiting' },
  },
  'waitlist.priority_weights': {
    name: 'Waitlist priority',
    help: "How far up the waitlist each tier goes (higher goes first; 0 is none), and whether only on the list for the member's qualifying stake.",
    fields: { weight: 'Weight', only_at_qualifying_stake: 'Only at their qualifying stake' },
  },
};

/** A setting's words, or undefined for a key with none yet. */
export function settingCopy(key: string): SettingCopy | undefined {
  return Object.hasOwn(settingKeys, key) ? settingKeys[key] : undefined;
}
