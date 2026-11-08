/** A member's way in: joining, signing in, the identity check at the club, Home, the waitlist, the door and the seat. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const ARRIVAL: readonly Workflow[] = [
  {
    key: 'sign-up-creator-code',
    title: 'A visitor joins through a creator code',
    steps: [
      step('visitor', 'web', '/', 'opens the website from a creator link and taps Join'),
      step('visitor', 'player', '/sign-up', 'enters number, the WhatsApp code and their name; the creator code comes with them'),
      step('member', 'player', '/', 'lands on Home'),
    ],
    refusals: [refusal('visitor', '/sign-up', 'a name with digits is refused in words, not a code')],
    endState: 'a member exists, credited to the creator code',
  },
  {
    key: 'sign-up-referral',
    title: 'A member brings a friend with their referral link',
    steps: [
      step('member', 'player', '/profile', 'copies their referral link'),
      step('visitor', 'player', '/sign-up', 'joins from the link'),
      step('member', 'player', '/rewards', 'sees what the referral earned, once the friend is verified'),
    ],
    refusals: [],
    endState: 'the new member is credited to the referrer',
  },
  {
    key: 'sign-in',
    title: 'A member signs in',
    steps: [step('member', 'player', '/sign-in', 'enters their number and the WhatsApp code'), step('member', 'player', '/', 'lands on Home')],
    refusals: [refusal('member', '/sign-in', 'a second code inside a minute says to wait, in words')],
    endState: 'the member is signed in and the code screen said the code came by WhatsApp',
  },
  {
    key: 'kyc-selfie-then-desk',
    title: 'A new member takes a selfie in the app and is checked at the desk on their first visit',
    steps: [
      step('member', 'player', '/kyc', 'takes a selfie'),
      step('member', 'player', '/kyc/return', 'opens the return address, as a link would, and is told what happens next'),
      step('host', 'console', '/kyc-review', 'checks the member in person at their first visit'),
      step('member', 'player', '/rewards', 'sees the sign-up bonus chips, at the amount of the selfie day'),
    ],
    refusals: [refusal('service', '/kyc-review', 'F&B staff cannot open identity checks')],
    endState: 'the member is verified once, with one sign-up bonus',
  },
  {
    key: 'kyc-reopened',
    title: 'A super admin reopens a check',
    steps: [
      step('super_admin', 'console', '/kyc-review', 'reopens a verified member’s check with a reason'),
      step('member', 'player', '/kyc', 'is asked to check again and takes a new selfie'),
      step('host', 'console', '/kyc-review', 'checks them at the desk'),
    ],
    refusals: [],
    endState: 'the member is verified again and no second sign-up bonus is paid',
  },
  {
    key: 'home-tables',
    title: 'A member sees tonight’s tables',
    steps: [step('member', 'player', '/', 'sees the tables by stakes, each with its minimum buy-in')],
    refusals: [],
    endState: 'the only money on the player app is "Min buy-in ₹…"',
  },
  {
    key: 'join-waitlist',
    title: 'A member asks to join a table’s waitlist and the floor approves',
    steps: [
      step('member', 'player', '/', 'asks to join Table 2’s waitlist'),
      step('floor', 'console', '/requests', 'sees the request arrive with a red count and a chime, and approves it'),
      step('member', 'player', '/', 'sees their place, without reloading'),
    ],
    refusals: [refusal('member', '/', 'a second request for the same table is refused in words')],
    endState: 'one place on Table 2’s list, and the member was told',
  },
  {
    key: 'join-request-removed',
    title: 'The floor removes a join request',
    steps: [
      step('member', 'player', '/', 'asks to join a table'),
      step('floor', 'console', '/waitlist?tab=lists', 'removes the request'),
      step('member', 'player', '/', 'is told, and can ask again'),
    ],
    refusals: [],
    endState: 'no place left behind, and the member knows why',
  },
  {
    key: 'seat-from-waitlist',
    title: 'The floor calls a member, who accepts and is seated with bonus chips',
    steps: [
      step('floor', 'console', '/waitlist?tab=lists', 'calls the first member for a free seat'),
      step('member', 'player', '/', 'gets the seat call by WhatsApp and push, and accepts'),
      step('floor', 'console', '/', 'seats them, redeeming 200 bonus chips with the buy-in'),
      step('member', 'player', '/rewards', 'sees 200 fewer bonus chips and a toast'),
    ],
    refusals: [refusal('floor', '/', 'more bonus chips than the member holds are refused')],
    endState: 'the member is seated at the called table; waitlist.called and bonus.redeemed were each sent once',
  },
  {
    key: 'missed-seat-call',
    title: 'A member misses a seat call',
    steps: [
      step('floor', 'console', '/waitlist?tab=lists', 'calls a member'),
      step('member', 'player', '/', 'does not answer; when the hold runs out they are told they missed it'),
      step('floor', 'console', '/waitlist?tab=lists', 'sees the next member offered the seat'),
    ],
    refusals: [],
    endState: 'the hold ended on time and the member knows',
  },
  {
    key: 'door-kiosk',
    title: 'A member checks in at the door kiosk with their card',
    steps: [
      step('member', 'player', '/card', 'shows the card QR, which starts with their membership number and changes every 30 seconds'),
      step('device', 'door', '/', 'scans it and welcomes them'),
    ],
    refusals: [refusal('device', '/', 'a code older than 30 seconds is refused'), refusal('device', '/', 'a self-excluded member is refused')],
    endState: 'one visit opened for the member',
  },
  {
    key: 'door-desk',
    title: 'The door checks a member in from the console',
    steps: [
      step('host', 'console', '/door?tab=check-in', 'finds the member by number and checks them in'),
      step('host', 'console', '/door?tab=players', 'sees them among today’s players'),
    ],
    refusals: [refusal('service', '/door?tab=check-in', 'F&B staff cannot check members in')],
    endState: 'one visit, and the desk can see who is in',
  },
];
