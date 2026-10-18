/**
 * The three things you need before editing a single rule, as one import surface.
 *
 * **A floor** (`baseRates.ts`): an accuracy figure means nothing without one.
 * **Claim volume against width** (`claimVolume.ts`): a rule that claims much
 * and constrains little is answering spots it cannot judge. **Triage**
 * (`triage.ts`, `separation.ts`): surviving failures sorted into buckets, and
 * the coordinates that split a rule's right answers from its wrong ones.
 */
export { answerLeaves } from './padAnswers.ts';
export { baseRates, type BaseRates } from './baseRates.ts';
export { claimVolume, type ClaimVolume } from './claimVolume.ts';
export { bucketCounts, triage, type FailureBucket, type TriagedFailure } from './triage.ts';
export { separation, type Separation } from './separation.ts';
