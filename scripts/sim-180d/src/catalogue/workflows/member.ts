/** What a member does for themselves: rewards, points and bonus chips, events, Learn, Profile, limits, exclusion. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const MEMBER: readonly Workflow[] = [
  {
    key: 'redeem-reward',
    title: 'A member redeems a reward with points and collects it at the door',
    steps: [
      step('member', 'player', '/rewards', 'sees points and bonus chips apart, and redeems a reward with points'),
      step('host', 'console', '/door?tab=handover', 'hands the reward over'),
      step('member', 'player', '/rewards', 'is told it is ready, then sees it collected'),
    ],
    refusals: [refusal('member', '/rewards', 'locked points cannot be spent'), refusal('member', '/rewards', 'a reward out of stock cannot be redeemed')],
    endState: 'points went down by the price once, and the reward was handed over',
  },
  {
    key: 'tournament-interest',
    title: 'A member registers interest in an event and the club marks them registered',
    steps: [
      step('member', 'player', '/events', 'registers interest'),
      step('admin', 'console', '/waitlist?tab=interest', 'marks them registered after they pay at the club'),
      step('member', 'player', '/events', 'sees they are registered'),
    ],
    refusals: [],
    endState: 'the member is registered and was told',
  },
  {
    key: 'learn',
    title: 'A member studies in Learn',
    steps: [step('member', 'player', '/learn', 'opens Learn'), step('member', 'player', '/learn/$sourceKey', 'reads a source and answers a quiz')],
    refusals: [],
    endState: 'their progress is saved',
  },
  {
    key: 'profile',
    title: 'A member sets their preferences and reads the house rules',
    steps: [
      step('member', 'player', '/profile', 'picks the times they like to play, turns push kinds on and off, and hides their name from the TVs'),
      step('member', 'player', '/profile/rules', 'reads the house rules, then presses Back'),
      step('member', 'player', '/profile', 'is back on Profile, not looping on the rules'),
    ],
    refusals: [],
    endState: 'the preferences are saved and Back leaves the rules',
  },
  {
    key: 'play-limits',
    title: 'A member sets a play limit',
    steps: [step('member', 'player', '/profile', 'sets a limit on their play'), step('floor', 'console', '/', 'sees the limit hold when seating them')],
    refusals: [],
    endState: 'the limit is kept',
  },
  {
    key: 'self-exclusion',
    title: 'A member excludes themselves',
    steps: [step('member', 'player', '/profile', 'excludes themselves for six months')],
    refusals: [
      refusal('device', '/', 'the door kiosk refuses them'),
      refusal('floor', '/', 'the floor cannot seat them'),
      refusal('member', '/', 'they cannot join a waitlist'),
    ],
    endState: 'no visit, seat or waitlist place for them while excluded',
  },
  {
    key: 'hidden-from-tv',
    title: 'A member hides their name from the TVs',
    steps: [step('member', 'player', '/profile', 'hides their name'), step('device', 'display', '/#waitlist', 'shows the waitlist without it')],
    refusals: [],
    endState: 'the name never reaches a TV',
  },
  {
    key: 'staff-who-plays',
    title: 'A member of staff joins as a member',
    steps: [step('visitor', 'player', '/sign-up', 'joins with their own number'), step('member', 'player', '/', 'uses the app as any member')],
    refusals: [refusal('floor', '/rewards?tab=rewards', 'they cannot give points or bonus chips to their own record')],
    endState: 'one person, a staff record and a member record, never acting on their own',
  },
  {
    key: 'notices',
    title: 'The club posts a notice and members see it',
    steps: [
      step('super_admin', 'console', '/settings?tab=settings', 'posts a notice with a start and an end'),
      step('member', 'player', '/', 'sees the notice card'),
    ],
    refusals: [],
    endState: 'the notice shows between its start and its end only',
  },
];
