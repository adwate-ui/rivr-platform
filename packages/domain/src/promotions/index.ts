export {
  promotionApplies,
  promotionReward,
  promotionsToGive,
  type PromotionCandidate,
  type PromotionFacts,
  type PromotionReward,
} from './promotions.ts';
export { playedSecondsInWindow, secondsInWindow, type Stint, type TableTime } from './window.ts';
// The typed model of console v3 (decisions 0470 to 0472), which replaces the rules above as the engine moves to versions.
export { cardWords, describePromotion, whoAndWhen, type PromotionNames } from './describe.ts';
export { isAtEligibleTable, isEligible, isTimeBased, LAPSED_DAYS, NEW_MEMBER_DAYS, type EligibilityContext } from './eligibility.ts';
export {
  computeGrant, NO_GRANT, toPromotionEvent, triggerOf, type Grant, type GrantRefusal, type Perk, type PromotionEvent, type PromotionEventKind,
} from './grant.ts';
export {
  checkLimits, decideGrant, ledgerEntryFor, periodKey, remainingBudget, slotKey, tallyFor, type GrantTally, type Ledger, type LedgerEntry, type LimitRefusal,
  type Refusal,
} from './limits.ts';
export { hourSteps, stepsReached, type HourStep, type HoursBonus } from './hourSteps.ts';
export { isInSchedule, openingMinutes, secondsInSchedule, type Span } from './schedule.ts';
export { simulate, type ReplayedEvent, type Simulation } from './simulation.ts';
export { stackGrants, type StackCandidate } from './stacking.ts';
export { transition, type Actor, type PromotionAction, type Transition, type TransitionError, type VersionState } from './status.ts';
export { sameTerms, termsDiff, TERMS_PARTS, type Terms, type TermsPart } from './terms.ts';
