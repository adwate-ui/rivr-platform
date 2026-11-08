/** The floor and the host: the live floor, requests, moves, points and bonus chips, the host queue. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const FLOOR: readonly Workflow[] = [
  {
    key: 'live-floor',
    title: 'The floor runs the night on the live floor',
    steps: [
      step('floor', 'console', '/', 'opens tables, moves a player between tables, and closes a table at the end'),
      step('floor', 'console', '/requests', 'works every waiting request in one list'),
    ],
    refusals: [refusal('floor', '/staff', 'the floor cannot manage staff'), refusal('floor', '/tables', 'the floor cannot set tables up')],
    endState: 'every seat and table closed at the night’s end',
  },
  {
    key: 'give-points',
    title: 'The floor gives a member points, up to the daily cap',
    steps: [step('floor', 'console', '/rewards?tab=rewards', 'gives a member points with a reason')],
    refusals: [refusal('floor', '/rewards?tab=rewards', 'points past the daily cap are refused and the owner is alerted')],
    endState: 'the points are credited once and in the audit log',
  },
  {
    key: 'add-bonus-chips',
    title: 'An admin adds bonus chips to a member by hand',
    steps: [step('admin', 'console', '/members', 'opens the member’s Points and bonus chips tab and adds chips with a reason')],
    refusals: [
      refusal('admin', '/members', 'their own record is refused'),
      refusal('admin', '/members', 'past the daily cap is refused and the owner alerted'),
    ],
    endState: 'the chips are granted through the promotions’ path, so the member gets a toast and a push',
  },
  {
    key: 'spin',
    title: 'The club spins the wheel for a member',
    steps: [
      step('admin', 'console', '/rewards?tab=spin-wheel', 'spins for a member who earned a spin'),
      step('device', 'display', '/#spin_wheel', 'shows the spin'),
      step('member', 'player', '/rewards', 'sees the prize'),
    ],
    refusals: [],
    endState: 'one spin used, the prize within the budget',
  },
  {
    key: 'host-queue',
    title: 'A host calls members from the host queue',
    steps: [step('host', 'console', '/host-queue', 'calls a member, records the call and an offer'), step('host', 'console', '/members', 'opens the member’s record')],
    refusals: [refusal('service', '/host-queue', 'F&B staff cannot open the host queue')],
    endState: 'the call and the offer are on the member’s record',
  },
];
