/** The rules under Settings, Floor, as staff read them: see settingKeys.ts. Apart to hold that file to its size. */
export const floorSettingKeys = {
  'call_time.minutes': {
    name: 'Call time',
    help: 'Minimum play before leaving, at this table type.',
    fields: { minutes: 'Minutes' },
  },
  'call_time.add_choices': {
    name: 'Add time choices',
    help: 'The lengths a player may ask to add, and the floor adds. 30 min, 1 hour and 2 hours unless set.',
    fields: { minutes: 'Lengths offered' },
    options: { 15: '15 min', 30: '30 min', 45: '45 min', 60: '1 hour', 90: '1 hour 30', 120: '2 hours', 180: '3 hours', 240: '4 hours' },
  },
  'floor.request_targets': {
    name: 'Request targets',
    help: 'How long a request waits on the Live floor before it shows late, in seconds: a top-up after 3 min and the rest after 5 min unless set.',
    fields: { top_up_seconds: 'Top-up, seconds', other_seconds: 'Others, seconds' },
  },
  'card.qr_rotation_seconds': {
    name: 'Door code refresh',
    help: "How often the card's code changes. Every 30 seconds unless set.",
    fields: { seconds: 'Every' },
  },
  'dealer.rotation_minutes': {
    name: 'Dealer rotation',
    help: 'How long a dealer deals at one table before the floor rotates them. 30 minutes unless set.',
    fields: { minutes: 'Minutes' },
  },
  'waitlist.hold_minutes': {
    name: 'Seat hold',
    help: 'How long a called seat is held, and a stepped-away place kept.',
    fields: { minutes: 'Minutes' },
  },
  'waitlist.interest_to_open': {
    name: 'Open a game at',
    help: 'Members waiting for a closed game before the floor is told to open a table. Not set never tells.',
    fields: { players: 'Players waiting' },
  },
  'waitlist.priority_weights': {
    name: 'Waitlist priority',
    help: "How far up the waitlist each tier goes (higher goes first; 0 is none), and whether only on the list for the member's qualifying stake.",
    fields: { weight: 'Weight', only_at_qualifying_stake: 'Only at their qualifying stake' },
  },
  'tv.leaderboard': {
    name: 'TV hours leaderboard',
    help: 'Who the TV hours leaderboard shows. Tonight\'s top 10 unless set.',
    fields: { period: 'Period', top: 'Top', min_hours: 'Played at least' },
    options: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
  },
};
