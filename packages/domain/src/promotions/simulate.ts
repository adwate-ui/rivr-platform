import type { PromotionConditions } from '@rivr/contracts/promotions';
import { err, ok, type Result } from '@rivr/contracts/result';
import { add, compare, subtract, ZERO, type Paise } from '../money/index.ts';
import type { PromotionDraft } from './builder.ts';
import {
  CLUB_CLOCK_OFFSET_MS, promotionApplies, promotionReward, promotionsToGive, type PromotionCandidate, type PromotionFacts, type PromotionReward,
} from './promotions.ts';

const DAY_MS = 86_400_000;

/**
 * One of last week's events as the database replays it (`promotion_replay`): a buy-in, or a closed visit's
 * hours played. For an hours-played rule with days or times, the points and hours are those of the time
 * inside its window, and a visit with none there is not replayed, as the engine weighs it
 * (`private.rule_in_window`).
 */
export interface ReplayEvent {
  readonly at: Date;
  readonly memberId: string;
  readonly tierId: string | null;
  readonly tableId: string | null;
  /** The table type's code at that table, such as nlh_100_200. */
  readonly stake: string | null;
  /** A buy-in's own money: ₹0 for one paid from bonus, and for hours played. */
  readonly amount: Paise;
  /** The points earned for the hours played; 0 for a buy-in. */
  readonly points: bigint;
  readonly hoursPlayed: number;
}

/** A promotion's budget: a rupee cap, a count of grants, either or neither. */
export interface SimulationBudget {
  readonly cap: Paise | null;
  readonly count: number | null;
}

export const NO_BUDGET: SimulationBudget = { cap: null, count: null };

/** What last week would have given: grants, members who got one, the rupee cost and the extra points. */
export interface PromotionSimulation {
  readonly events: number;
  readonly grants: number;
  readonly members: number;
  /** A bonus's cost; points cost nothing in rupees (the owner's answer to #507). */
  readonly cost: Paise;
  readonly points: bigint;
  /** The rupee budget less the cost; null with no rupee cap. */
  readonly budgetLeft: Paise | null;
  /** Whether the budget, in rupees or grants, stopped a grant the rule would have given. */
  readonly isBudgetReached: boolean;
}

/** Why a promotion cannot be replayed: it weighs an event, or a fact, that last week's replay does not hold. */
export type SimulationError = 'not_replayable';

// What a replay holds: buy-ins and hours played, with when, where, the tier and what was earned. A rule
// that asks about past visits, call time or a hand is not replayed.
const REPLAYED_TRIGGERS: ReadonlySet<string> = new Set(['buy_in', 'hours_played']);
const REPLAYED_CONDITIONS: ReadonlySet<string> = new Set(['days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours']);

/** As private.rule_in_window: an hours-played rule with days or times has had them met by the replay, with its stakes and tables. */
function conditionsToWeigh(draft: PromotionDraft): PromotionConditions {
  const { trigger, conditions } = draft.rule;
  if (trigger !== 'hours_played' || (conditions.days === undefined && conditions.from === undefined)) return conditions;
  const { days: _days, from: _from, until: _until, stakes: _stakes, table_ids: _tables, ...rest } = conditions;
  return rest;
}

/** The club day an event falls on (06:00 to 06:00 IST), as a whole number of days. */
function clubDayOf(at: Date): number {
  return Math.floor((at.getTime() + CLUB_CLOCK_OFFSET_MS) / DAY_MS);
}

/** Counts by key, starting at zero. */
class Tally {
  private readonly counts = new Map<string, number>();
  of(key: string): number {
    return this.counts.get(key) ?? 0;
  }
  addOne(key: string): void {
    this.counts.set(key, this.of(key) + 1);
  }
}

/** One replay: the grants so far, by club day, table and member, and what they cost. */
class Replay {
  private readonly byDay = new Tally();
  private readonly byMember = new Tally();
  private readonly members = new Set<string>();
  private cost = ZERO;
  private points = 0n;
  private grants = 0;
  private isBudgetReached = false;

  constructor(private readonly draft: PromotionDraft, private readonly conditions: PromotionConditions, private readonly budget: SimulationBudget) {}

  /** Weighs one event as the engine would: applies, then its reward, then whether the limits let it be given. */
  weigh(event: ReplayEvent): void {
    const day = clubDayOf(event.at);
    const reward = promotionApplies(this.conditions, this.factsOf(event, day))
      ? promotionReward(this.draft.rule.effect, { amount: event.amount, points: event.points })
      : null;
    if (reward !== null) this.give(event, day, reward);
  }

  private factsOf(event: ReplayEvent, day: number): PromotionFacts {
    return {
      at: event.at, tierId: event.tierId, stake: event.stake, tableId: event.tableId, visitsInMonth: 0, daysSinceLastVisit: null,
      isCallTimeComplete: false, grantedToday: this.byDay.of(`${day}`), grantedTodayAtTable: this.byDay.of(`${day}|${event.tableId ?? ''}`),
      hoursPlayed: event.hoursPlayed, hand: null,
    };
  }

  /** The promotion as the engine's candidate for this grant: its cost, and what is left of each limit. */
  private candidateFor(reward: PromotionReward, playerKey: string): PromotionCandidate {
    const perPlayer = this.draft.perPlayer;
    return {
      promotion: 'simulated', stacks: true, cost: reward.cost, isGiven: false,
      budgetLeft: this.budget.cap === null ? null : subtract(this.budget.cap, this.cost),
      grantsLeft: this.budget.count === null ? null : this.budget.count - this.grants,
      playerLeft: perPlayer === null ? null : perPlayer.limit - this.byMember.of(playerKey),
    };
  }

  private give(event: ReplayEvent, day: number, reward: PromotionReward): void {
    const playerKey = this.draft.perPlayer?.period === 'day' ? `${event.memberId}|${day}` : event.memberId;
    const candidate = this.candidateFor(reward, playerKey);
    if (promotionsToGive([candidate]).length === 0) {
      // The budget stopped it only when the member's own limit would have let it through.
      const { budgetLeft, grantsLeft, playerLeft } = candidate;
      const isOverBudget = (budgetLeft !== null && compare(reward.cost, budgetLeft) > 0) || grantsLeft === 0;
      this.isBudgetReached ||= isOverBudget && (playerLeft ?? 1) > 0;
      return;
    }
    this.grants += 1;
    this.cost = add(this.cost, reward.cost);
    this.points += reward.points;
    this.members.add(event.memberId);
    this.byDay.addOne(`${day}`);
    this.byDay.addOne(`${day}|${event.tableId ?? ''}`);
    this.byMember.addOne(playerKey);
  }

  result(events: number): PromotionSimulation {
    const budgetLeft = this.budget.cap === null ? null : subtract(this.budget.cap, this.cost);
    return { events, grants: this.grants, members: this.members.size, cost: this.cost, points: this.points, budgetLeft, isBudgetReached: this.isBudgetReached };
  }
}

/**
 * Replays a promotion on last week's events before it is published (scope-v1 module 7 controls; #144).
 * Events are weighed in time order, as the engine weighs them live: promotionApplies with the first-N
 * counts so far that club day, promotionReward, then promotionsToGive with what is left of the budget
 * and of the member's per-player limit, so the replay cannot disagree with the engine. It weighs the one
 * promotion alone: others that would stack with it, or stop it, are not replayed, so its cost errs high.
 */
export function simulatePromotion(
  draft: PromotionDraft,
  events: readonly ReplayEvent[],
  budget: SimulationBudget = NO_BUDGET,
): Result<PromotionSimulation, SimulationError> {
  const { trigger, conditions } = draft.rule;
  if (!REPLAYED_TRIGGERS.has(trigger) || Object.keys(conditions).some((name) => !REPLAYED_CONDITIONS.has(name))) {
    return err('not_replayable');
  }
  const replay = new Replay(draft, conditionsToWeigh(draft), budget);
  [...events].sort((one, other) => one.at.getTime() - other.at.getTime()).forEach((event) => replay.weigh(event));
  return ok(replay.result(events.length));
}
