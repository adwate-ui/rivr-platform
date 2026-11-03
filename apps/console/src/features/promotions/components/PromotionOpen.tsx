import type { PromotionStatus } from '@rivr/contracts/promotionModel';
import { approverViewOf, usePromotionVersions, type PromotionVersionView } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import type { Actor } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import type { BuilderNames } from '../hooks/useBuilderNames.ts';
import { formFromTerms } from './builderForm.ts';
import { PromotionBuilder, type BuilderStart } from './PromotionBuilder.tsx';
import { PromotionReview } from './PromotionReview.tsx';

const RUNNING: readonly PromotionStatus[] = ['scheduled', 'live', 'paused'];

/** Above a draft: why it was sent back, or that the running version runs on until it is approved. */
function draftNotice(draft: PromotionVersionView, running: PromotionVersionView | undefined): string | null {
  if (draft.rejectedReason !== null) return t('console.promotions.builder.sentBack', { name: draft.decidedBy ?? '', reason: draft.rejectedReason });
  return running === undefined ? null : t('console.promotions.builder.editsLive', { next: draft.version, current: running.version });
}

/**
 * Where the builder starts on a promotion's versions: its open draft; else the running version, whose change drafts the
 * next one (decision 0437); else, for one that has ended, a new promotion on its terms. Null when no version can be read.
 */
export function startFrom(versions: readonly PromotionVersionView[], promotionId: string): BuilderStart | null {
  const draft = versions.find((one) => one.status === 'draft');
  const running = versions.find((one) => RUNNING.includes(one.status));
  if (draft?.terms) {
    const terms = draft.terms;
    return { promotionId, form: formFromTerms(terms), title: t('console.promotions.builder.editTitle', { name: terms.name }), notice: draftNotice(draft, running),
      draft: { versionId: draft.id, terms, simulation: draft.simulation } };
  }
  if (running?.terms) {
    const notice = t('console.promotions.builder.editsLive', { next: running.version + 1, current: running.version });
    return { promotionId, form: formFromTerms(running.terms), title: t('console.promotions.builder.editTitle', { name: running.terms.name }), notice, draft: null };
  }
  const last = versions.find((one) => one.terms !== null)?.terms;
  if (last === undefined || last === null) return null;
  return { promotionId: null, form: { ...formFromTerms(last), startsOn: clubDay(new Date()) }, title: t('console.promotions.builder.newTitle'), notice: null, draft: null };
}

interface PromotionOpenProps {
  venueId: string;
  promotionId: string;
  names: BuilderNames;
  actor: Actor;
  onDone: () => void;
}

/** A promotion opened from the list: the approver's view while a version waits, otherwise the builder on its versions. */
export function PromotionOpen({ venueId, promotionId, names, actor, onDone }: PromotionOpenProps) {
  const versions = usePromotionVersions(promotionId);
  const title = t('console.promotions.title');
  if (versions.data === undefined) {
    return versions.isError ? <Screen title={title} status="error" onRetry={() => void versions.refetch()} /> : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  const view = approverViewOf(versions.data);
  if (view.waiting !== null) return <PromotionReview venueId={venueId} names={names} actor={actor} view={{ ...view, waiting: view.waiting }} onDone={onDone} />;
  const start = startFrom(versions.data, promotionId);
  if (start === null) return <Screen title={title} status="error" errorText={t('console.promotions.open.legacy')} />;
  return <PromotionBuilder venueId={venueId} names={names} actor={actor} start={start} onDone={onDone} />;
}
