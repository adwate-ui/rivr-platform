import type { PromotionSimulationResult, PromotionTerms } from '@rivr/contracts/promotionModel';
import { ok, type Result } from '@rivr/contracts/result';
import { usePromotionVersionActions, type PromotionVersionFailure } from '@rivr/db';
import type { Terms } from '@rivr/domain/promotions';
import { useRef, useState } from 'react';
import { cardWords, type PromotionNames } from '../components/promotionWords.ts';

/** A simulation as the builder shows it: the terms it ran on, what it gave, and the club days replayed when known. */
export interface SimulationOnTerms {
  readonly terms: Terms;
  readonly result: PromotionSimulationResult;
  readonly from: Date | null;
  readonly to: Date | null;
}

/** Where the builder starts: the promotion it changes (none for a new one) and the open draft it holds, if any. */
export interface FlowStart {
  readonly promotionId: string | null;
  readonly draft: { readonly versionId: string; readonly terms: PromotionTerms; readonly simulation: PromotionSimulationResult | null } | null;
}

/** The draft as last saved: its version, its terms as text, and whether the database holds a simulation of them. */
interface Saved {
  readonly versionId: string;
  readonly json: string;
  readonly hasSimulation: boolean;
}

type Outcome = Result<string, PromotionVersionFailure>;

/** One request id for one set of terms, kept for a retry after a lost answer and new with any change (A3). */
function useRequestIds() {
  const current = useRef({ json: '', id: '' });
  return (json: string) => {
    if (current.current.json !== json || current.current.id === '') current.current = { json, id: crypto.randomUUID() };
    return current.current.id;
  };
}

/** Saves the draft when its terms changed since the last save; a save clears the simulation the database held. */
function useDraftSaver(start: FlowStart, names: PromotionNames, actions: ReturnType<typeof usePromotionVersionActions>) {
  const saved = useRef<Saved | null>(start.draft === null ? null : {
    versionId: start.draft.versionId, json: JSON.stringify(start.draft.terms), hasSimulation: start.draft.simulation !== null,
  });
  const promotionId = useRef(start.promotionId);
  const requestIdFor = useRequestIds();
  const save = async (terms: PromotionTerms): Promise<Result<Saved, PromotionVersionFailure>> => {
    const json = JSON.stringify(terms);
    if (saved.current?.json === json) return ok(saved.current);
    const result = await actions.saveDraft.mutateAsync({ promotionId: promotionId.current, terms, words: cardWords(terms, names), requestId: requestIdFor(json) });
    if (!result.ok) return result;
    saved.current = { versionId: result.value.versionId, json, hasSimulation: false };
    promotionId.current = result.value.promotionId;
    return ok(saved.current);
  };
  return { save, markSimulated: (draft: Saved) => { saved.current = { ...draft, hasSimulation: true }; } };
}

/**
 * The builder's calls on its draft (decision 0471): Save draft, Simulate (saving first, as a simulation runs on a saved
 * version) and Submit for approval (saving and simulating again first when the words changed since, as a save clears
 * the stored simulation). Each gives the version's id, or why it did not go through.
 */
export function useBuilderFlow(venueId: string, start: FlowStart, names: PromotionNames) {
  const actions = usePromotionVersionActions(venueId);
  const { save, markSimulated } = useDraftSaver(start, names, actions);
  const [simulation, setSimulation] = useState<SimulationOnTerms | null>(() => (start.draft?.simulation
    ? { terms: start.draft.terms, result: start.draft.simulation, from: null, to: null } : null));

  const simulate = async (terms: PromotionTerms): Promise<Outcome> => {
    const draft = await save(terms);
    if (!draft.ok) return draft;
    const run = await actions.simulate.mutateAsync({ versionId: draft.value.versionId, terms });
    if (!run.ok) return run;
    markSimulated(draft.value);
    setSimulation({ terms, result: run.value, from: run.value.from, to: run.value.to });
    return ok(draft.value.versionId);
  };

  const submit = async (terms: PromotionTerms): Promise<Outcome> => {
    const draft = await save(terms);
    if (!draft.ok) return draft;
    const ready = draft.value.hasSimulation ? ok(draft.value.versionId) : await simulate(terms);
    if (!ready.ok) return ready;
    const sent = await actions.submit.mutateAsync(ready.value);
    return sent.ok ? ok(ready.value) : sent;
  };

  const saveDraft = async (terms: PromotionTerms): Promise<Outcome> => {
    const draft = await save(terms);
    return draft.ok ? ok(draft.value.versionId) : draft;
  };
  const isBusy = actions.saveDraft.isPending || actions.simulate.isPending || actions.submit.isPending;
  return { simulation, isBusy, isSimulating: actions.simulate.isPending, isSubmitting: actions.submit.isPending, saveDraft, simulate, submit };
}
