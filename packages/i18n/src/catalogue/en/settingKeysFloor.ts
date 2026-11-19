/** The rules under Settings, Floor, as staff read them: see settingKeys.ts. Apart to hold that file to its size. */
export const floorSettingKeys = {
  'call_time.minutes': {
    name: 'Call time',
    help: 'Least time at the table, per stake',
    fields: { minutes: 'Minutes' },
  },
  'call_time.add_choices': {
    name: 'Set call time choices',
    help: 'Lengths to set a call time by',
    fields: { minutes: 'Lengths offered' },
  },
  /** Its own list since 19 Nov (#1089): the member's Extend and the floor's alike. */
  'call_time.extend_choices': {
    name: 'Extend call time choices',
    help: 'Lengths to extend a set call time by',
    hints: { minutes: 'Extend adds time beyond the current end.' },
    fields: { minutes: 'Lengths offered' },
  },
  'fnb.enabled': {
    name: 'Orders',
    help: 'Members and staff can place orders',
    hints: { enabled: 'Off stops new orders. Open orders are still served.' },
    fields: { enabled: 'Take orders' },
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
  'tv.boards': {
    name: 'Boards shown',
    help: 'A board switched off shows on no TV',
    fields: { waitlist: 'Waitlist', call_time: 'Call time', promotions: 'Promotions', leaderboard: 'Hours leaderboard', high_hand: 'High hand bonus' },
  },
  'tv.board_seconds': {
    name: 'Time on each board',
    help: 'Before the TV moves to the next board',
    hints: { promotions_seconds: 'Each promotion shows this long.' },
    fields: {
      waitlist_seconds: 'Waitlist', call_time_seconds: 'Call time', promotions_seconds: 'Promotions', leaderboard_seconds: 'Hours leaderboard',
      high_hand_seconds: 'High hand bonus',
    },
  },
  'tv.leaderboard': {
    name: 'TV hours leaderboard',
    help: 'Who the hours board shows',
    hints: { period: 'The list beside Tonight. Set to Tonight, it is This week.', top: 'The top 10 unless set.' },
    fields: { period: 'Period', top: 'Top', min_hours: 'Played at least' },
    options: { tonight: 'Tonight', week: 'This week', month: 'This month', all: 'All time' },
  },
};
