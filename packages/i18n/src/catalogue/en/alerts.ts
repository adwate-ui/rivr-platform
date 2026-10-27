/**
 * What the owner's alert message says each kind of alert is (#100): words only, never an alert's
 * details, so an alert carries no personal data. The details are on the owner dashboard.
 */
export const alerts = {
  kinds: {
    'auth.sms_rate_limit': 'sign-in codes are being refused because the hourly limit is used up',
    'cage.rate_limit': 'a cashier, or the venue, reached the limit of cage money calls in a minute',
    'aml.structuring': 'a member\'s cash buy-ins ended just under the limit several times: the AML register has an entry to review',
    'control.engaged': 'the kill switch was engaged',
    'control.release_asked': 'a release of the kill switch was asked for',
    'control.released': 'the kill switch was released',
    'dealer.uncounted': 'a dealer down closed without its count',
    'dealer.variance': 'a dealer down closed with a variance',
    'devices.pairing_guessed': 'someone kept guessing a device pairing code',
    'eod.opening_variance': 'a cage shift opened with a variance',
    'eod.variance': 'a cage shift closed with a variance',
    'export.large': 'a large export was taken: a table, or an archive',
    'exports.key_changed': 'the export archive\'s key was changed',
    'invoice.rake_negative': 'a night’s rake and tournament fees came to less than nothing',
    'invoice.rake_refused': 'a night’s rake invoice could not be issued',
    'mis.not_stored': 'the monthly MIS could not be stored',
    'outbox.delivery_failed': 'a message or post could not be delivered',
    'outbox.failures': 'many messages or posts are failing',
    'settings.control_changed': 'a super admin changed a control setting: credit, second approval, TDS, alert thresholds, GST, or high-hand or jackpot payouts',
    'withdrawal.payout_orphaned': 'Cashfree paid a withdrawal the cage had already paid another way or given up on',
    'withdrawal.payout_stuck': 'a Cashfree payout of a withdrawal is stuck: it could not be recorded, or has waited half an hour',
  },
  /** For a kind not listed here. */
  other: 'something needs your attention',
} as const;
