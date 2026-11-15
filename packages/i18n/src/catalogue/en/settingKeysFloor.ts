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
  },
  'floor.request_targets': {
    name: 'Request targets',
    help: 'When a waiting request shows late',
    fields: { top_up_seconds: 'Top-up, seconds', other_seconds: 'Others, seconds' },
  },
  'waitlist.hold_minutes': {
    name: 'Seat hold',
    help: 'How long a called seat is held',
    hints: { minutes: 'A stepped-away place is kept as long.' },
    fields: { minutes: 'Minutes' },
  },
  'waitlist.interest_to_open': {
    name: 'Open a game at',
    help: 'Players waiting before the floor is told',
    hints: { players: 'For a closed game. Not set never tells.' },
    fields: { players: 'Players waiting' },
  },
  'waitlist.priority_weights': {
    name: 'Waitlist priority',
    help: 'How far up the list each tier goes',
    hints: { weight: 'Higher goes first. 0 is none.' },
    fields: { weight: 'Weight', only_at_qualifying_stake: 'Only at their qualifying stake' },
  },
  'tv.leaderboard': {
    name: 'TV hours leaderboard',
    help: 'Who the hours board shows',
    hints: { top: "Tonight's top 10 unless set." },
    fields: { period: 'Period', top: 'Top', min_hours: 'Played at least' },
    options: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
  },
};
