/** The rules under Settings, Floor, as staff read them: see settingKeys.ts. Apart to hold that file to its size. */
export const floorSettingKeys = {
  'call_time.minutes': {
    name: 'Call time',
    help: 'Least time at the table, per stake',
    fields: { minutes: 'Minutes' },
  },
  'call_time.add_choices': {
    name: 'Add time choices',
    help: 'Lengths a seated member can ask for',
    fields: { minutes: 'Lengths offered' },
    options: { 15: '15 min', 30: '30 min', 45: '45 min', 60: '1 hour', 90: '1 hour 30', 120: '2 hours', 180: '3 hours', 240: '4 hours' },
  },
  'floor.request_targets': {
    name: 'Request targets',
    help: 'When a waiting request shows late',
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
    help: 'How long a called seat is held',
    fields: { minutes: 'Minutes' },
  },
  'waitlist.interest_to_open': {
    name: 'Open a game at',
    help: 'Players waiting before the floor is told',
    fields: { players: 'Players waiting' },
  },
  'waitlist.priority_weights': {
    name: 'Waitlist priority',
    help: 'How far up the list each tier goes',
    fields: { weight: 'Weight', only_at_qualifying_stake: 'Only at their qualifying stake' },
  },
  'tv.leaderboard': {
    name: 'TV hours leaderboard',
    help: 'Who the hours board shows',
    fields: { period: 'Period', top: 'Top', min_hours: 'Played at least' },
    options: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
  },
};
