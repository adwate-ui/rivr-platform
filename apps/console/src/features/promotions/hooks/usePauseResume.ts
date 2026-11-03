import type { Result } from '@rivr/contracts/result';
import { usePromotionActions, usePromotionVersionActions, type PromotionOverview, type PromotionVersionFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { useToast } from '@rivr/ui';
import { useState } from 'react';

/**
 * Pause and Resume on the list (console v3), each said in a toast whose Undo is the other: the exact compensating call. A
 * promotion in versions pauses its running version; one still run by its rule pauses its card (decision 0491).
 */
export function usePauseResume(venueId: string) {
  const versions = usePromotionVersionActions(venueId);
  const rules = usePromotionActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<PromotionVersionFailure | null>(null);
  const setLive = (promotion: PromotionOverview, isLive: boolean): Promise<Result<null, PromotionVersionFailure>> => {
    if (promotion.isLegacy || promotion.currentVersionId === null) return rules.setLive.mutateAsync({ id: promotion.id, isLive });
    return versions.setLive.mutateAsync({ versionId: promotion.currentVersionId, isLive });
  };
  const turn = async (promotion: PromotionOverview, isLive: boolean) => {
    const outcome = await setLive(promotion, isLive);
    setFailure(outcome.ok ? null : outcome.error);
    if (!outcome.ok) return;
    const said = t(isLive ? 'console.promotions.toast.resumed' : 'console.promotions.toast.paused', { name: promotion.name });
    toast(said, { onUndo: () => void setLive(promotion, !isLive) });
  };
  return {
    failure,
    isBusy: versions.setLive.isPending || rules.setLive.isPending,
    pause: (promotion: PromotionOverview) => void turn(promotion, false),
    resume: (promotion: PromotionOverview) => void turn(promotion, true),
  };
}
