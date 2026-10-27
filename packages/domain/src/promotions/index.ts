export { promotionDraft, type PromotionDraft } from './builder.ts';
export {
  promotionApplies,
  promotionReward,
  promotionsToGive,
  type PromotionCandidate,
  type PromotionFacts,
  type PromotionReward,
} from './promotions.ts';
export {
  NO_BUDGET,
  simulatePromotion,
  type PromotionSimulation,
  type ReplayEvent,
  type SimulationBudget,
  type SimulationError,
} from './simulate.ts';
export { playedSecondsInWindow, secondsInWindow, type Stint, type TableTime } from './window.ts';
