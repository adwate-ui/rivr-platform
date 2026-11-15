import type { SettingKey } from '@rivr/contracts/settings';

/** The tabs of Settings that hold rules, each with its groups in order (redesign RD-18). */
export const AREA_GROUPS = {
  floor: ['seating', 'time', 'identity'],
  members: ['bonus', 'membership'],
  tvs: ['rotation'],
} as const;

export type GroupedArea = keyof typeof AREA_GROUPS;
export type SettingGroup = (typeof AREA_GROUPS)[GroupedArea][number];

/**
 * The group each setting on the screen sits in. A setting with no group is not shown: the rules of the money areas
 * hidden at the owner's word (29 Oct, decision 0284), the cab offer while cab requests are off (audit F-113), and the
 * door code and dealer rotation, which go with the card and with dealers (owner, 15 Nov).
 */
const GROUP_OF: Readonly<Partial<Record<SettingKey, SettingGroup>>> = {
  'waitlist.hold_minutes': 'seating',
  'waitlist.interest_to_open': 'seating',
  'waitlist.priority_weights': 'seating',
  'floor.request_targets': 'seating',
  'call_time.minutes': 'time',
  'call_time.add_choices': 'time',
  // The floor runs the desk's check (the owner, 5 Nov; decision 0502).
  'kyc.at_the_club': 'identity',
  'bonus.expiry_days': 'bonus',
  'bonus.daily_staff_cap': 'bonus',
  'bonus.by_hand_cap': 'bonus',
  'bonus.visit_cap': 'bonus',
  'tier.default': 'membership',
  'tv.leaderboard': 'rotation',
};

/** A group's settings, by key, in the order the screen lists them. */
export function keysOf(group: SettingGroup): readonly string[] {
  return Object.entries(GROUP_OF).filter(([, own]) => own === group).map(([key]) => key);
}
