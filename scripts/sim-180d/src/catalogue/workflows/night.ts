/** A member's night at the table: food and drink, top-ups, call time, breaks, leaving, play-time bonus, feedback. */
import type { Workflow } from '../types.ts';
import { refusal, step } from './step.ts';

export const NIGHT: readonly Workflow[] = [
  {
    key: 'order-food',
    title: 'A seated member orders food, and F&B serves and delivers it',
    steps: [
      step('member', 'player', '/fnb', 'orders a chai and a sandwich to their seat'),
      step('service', 'console', '/fnb', 'hears the chime, sees the count, and marks the order on its way, then delivered'),
      step('member', 'player', '/fnb', 'sees the order on its way and delivered, with its time'),
    ],
    refusals: [refusal('service', '/members', 'F&B staff cannot open members')],
    endState: 'the order is delivered to the member’s current seat and the member was told',
  },
  {
    key: 'cancel-food',
    title: 'A member cancels an order before it is served',
    steps: [step('member', 'player', '/fnb', 'cancels an order still Placed'), step('service', 'console', '/fnb', 'sees it cancelled')],
    refusals: [refusal('member', '/fnb', 'an order already on its way cannot be cancelled')],
    endState: 'the order is cancelled and leaves the queue',
  },
  {
    key: 'void-food',
    title: 'F&B voids an order with a reason',
    steps: [step('service', 'console', '/fnb', 'voids an order, giving a reason'), step('member', 'player', '/fnb', 'sees the reason')],
    refusals: [],
    endState: 'the order is voided with its reason',
  },
  {
    key: 'floor-orders-food',
    title: 'The floor orders food for a seated member',
    steps: [step('floor', 'console', '/', 'orders for the member from their seat'), step('service', 'console', '/fnb', 'sees the order with the right seat')],
    refusals: [],
    endState: 'one order at the member’s seat',
  },
  {
    key: 'top-up',
    title: 'A seated member asks for a top-up and the floor brings it',
    steps: [
      step('member', 'player', '/', 'asks for a top-up from their seat'),
      step('floor', 'console', '/requests', 'sees it with a red count and a chime, and marks it done'),
      step('member', 'player', '/', 'is told it is done'),
    ],
    refusals: [],
    endState: 'the top-up closed, at the seat the member is in now',
  },
  {
    key: 'call-time-and-add-time',
    title: 'The floor sets call time, and the member asks for more time once it is met',
    steps: [
      step('floor', 'console', '/', 'sets the member’s call time'),
      step('member', 'player', '/', 'sees the countdown, and asks to add time once call time is met'),
      step('floor', 'console', '/requests', 'approves the extra time'),
      step('member', 'player', '/', 'sees the new call time'),
    ],
    refusals: [refusal('member', '/', 'adding time before call time is met is refused in words')],
    endState: 'call time moved only with the floor’s approval',
  },
  {
    key: 'break',
    title: 'A seated member takes a break and comes back',
    steps: [
      step('member', 'player', '/', 'takes a break'),
      step('floor', 'console', '/', 'sees the seat on a break, and is told'),
      step('member', 'player', '/', 'comes back; no Join button shows while on a break'),
    ],
    refusals: [],
    endState: 'the seat is kept and the member is back',
  },
  {
    key: 'leaving-list',
    title: 'A member asks to leave and the floor lets them go',
    steps: [
      step('member', 'player', '/', 'asks to leave'),
      step('floor', 'console', '/', 'sees them on the leaving list, and lets them go when call time allows'),
      step('member', 'player', '/', 'is told they can go'),
    ],
    refusals: [],
    endState: 'the seat and the visit closed, and nothing of the night was left open',
  },
  {
    key: 'play-time-bonus',
    title: 'A member earns play-time bonus chips while seated',
    steps: [
      step('member', 'player', '/', 'plays past each play-time step'),
      step('member', 'player', '/rewards', 'sees the bonus chips for each step, with a toast and a push'),
    ],
    refusals: [],
    endState: 'each step paid once, only while seated, within the cap',
  },
  {
    key: 'feedback',
    title: 'A member rates a visit one star, and the club follows up',
    steps: [
      step('member', 'player', '/sessions', 'opens their last visit'),
      step('member', 'player', '/sessions/$sessionId', 'rates it one star with a comment'),
      step('admin', 'console', '/feedback', 'sees it, and the owner is alerted; records what was done'),
      step('member', 'player', '/sessions/$sessionId', 'sees what was done'),
    ],
    refusals: [],
    endState: 'the rating reached the owner and the member saw the answer',
  },
];
