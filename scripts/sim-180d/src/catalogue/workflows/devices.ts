/** The dealer's tablet, the TVs and the website's visitor. */
import type { Workflow } from '../types.ts';
import { step } from './step.ts';

export const DEVICES: readonly Workflow[] = [
  {
    key: 'tablet-dealer',
    title: 'A dealer signs in on the table’s tablet and runs the table',
    steps: [
      step('dealer', 'tablet', '/', 'signs in with their PIN, sees the seats, orders food for a seat, and hands over at rotation'),
      step('service', 'console', '/fnb', 'sees the tablet’s order'),
    ],
    refusals: [],
    endState: 'the dealer’s down ended at rotation',
  },
  {
    key: 'tablet-offline',
    title: 'A tablet goes offline and comes back',
    steps: [step('dealer', 'tablet', '/', 'keeps working while offline, and everything queued is sent once on reconnect')],
    refusals: [],
    endState: 'nothing queued was lost or sent twice',
  },
  {
    key: 'tv-rotation',
    title: 'A TV shows each of its modes',
    steps: [
      step('device', 'display', '/#waitlist', 'shows the waitlists'),
      step('device', 'display', '/#call_time', 'shows call times'),
      step('device', 'display', '/#promotions', 'shows promotions'),
      step('device', 'display', '/#rewards', 'shows rewards'),
      step('device', 'display', '/#league', 'shows the league'),
      step('device', 'display', '/#social_wall', 'shows the social wall'),
      step('device', 'display', '/#spin_wheel', 'shows the spin wheel'),
    ],
    refusals: [],
    endState: 'every mode read well at 1920 × 1080, with nothing empty or cut off',
  },
  {
    key: 'website-visitor',
    title: 'A visitor reads the website and goes to join',
    steps: [
      step('visitor', 'web', '/', 'reads the home page'),
      step('visitor', 'web', '/$slug', 'reads a page'),
      step('visitor', 'web', '/404', 'mistypes an address'),
      step('visitor', 'player', '/sign-up', 'follows Join to the app'),
    ],
    refusals: [],
    endState: 'the visitor reached sign-up',
  },
];
