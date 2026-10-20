import { promotionBuilderSchema, type PromotionBuilder } from '@rivr/contracts';
import { usePromotionActions, usePromotionStakes, useStaffVenue, type PromotionStake } from '@rivr/db';
import { promotionDraft } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Button, DisplayPreview, ErrorMessage, Grid, Heading, Inline, PromotionCard, Screen, Stack, Text, TvPromotionSlide } from '@rivr/ui';
import { useState } from 'react';
import { BuilderBlocks } from './BuilderBlocks.tsx';
import { rewardDetail, rewardTitle, runsText } from './promotionCopy.ts';
import { RunningList } from './RunningList.tsx';

// The bonus cap starts at ₹5,000 a buy-in, which the floor may change (question #415).
const START: PromotionBuilder = { days: [], from: null, until: null, stake: null, reward: 'double_points', limit: 'none', bonus_cap_rupees: 5000 };

/** The player card and the TV slide, as the choices so far would publish them. */
function Previews({ title, detail, runs }: { title: string; detail: string | undefined; runs: string }) {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Text variant="label" tone="muted">{t('console.promotions.playerApp')}</Text>
        <PromotionCard title={title} detail={detail} runs={runs} />
      </Stack>
      <Stack gap={2}>
        <Text variant="label" tone="muted">{t('console.promotions.tvSlide')}</Text>
        <DisplayPreview label={t('console.promotions.tvSlide')}>
          <TvPromotionSlide label={t('console.promotions.slideLabel')} title={title} detail={detail} when={runs} />
        </DisplayPreview>
      </Stack>
    </Stack>
  );
}

function Builder({ venueId, stakes }: { venueId: string; stakes: readonly PromotionStake[] }) {
  const { publish } = usePromotionActions(venueId);
  const [choices, setChoices] = useState(START);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const title = rewardTitle(choices);
  const detail = rewardDetail(choices);
  const runs = runsText(choices, stakes);
  const submit = async () => {
    const checked = promotionBuilderSchema.safeParse(choices);
    if (!checked.success) {
      const isCap = checked.error.issues.some((issue) => issue.path[0] === 'bonus_cap_rupees');
      return setOutcome({ ok: false, text: t(isCap ? 'console.promotions.failures.invalidCap' : 'console.promotions.failures.invalid') });
    }
    const result = await publish.mutateAsync({ name: title, detail, runs, draft: promotionDraft(choices) });
    if (result.ok) setChoices(START);
    setOutcome(result.ok ? { ok: true, text: t('console.promotions.published', { name: title }) } : { ok: false, text: t(`console.promotions.failures.${result.error}`) });
  };
  return (
    <Grid columns={2} gap={12}>
      <Stack gap={6}>
        <Heading level={2} variant="section">{t('console.promotions.newPromotion')}</Heading>
        <BuilderBlocks choices={choices} stakes={stakes} isDisabled={publish.isPending} onChange={(next) => { setChoices(next); setOutcome(null); }} />
        <Inline gap={4}>
          <Button variant="primary" isLoading={publish.isPending} onClick={() => void submit()}>{t('console.promotions.publish')}</Button>
          {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
        </Inline>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
      <Previews title={title} detail={detail} runs={runs} />
    </Grid>
  );
}

function PromotionsBody({ venueId }: { venueId: string }) {
  const stakes = usePromotionStakes(venueId);
  const title = t('console.promotions.title');
  if (stakes.isPending) return <Screen title={title} status="loading" />;
  if (stakes.data === undefined) return <Screen title={title} status="error" onRetry={() => void stakes.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <RunningList venueId={venueId} />
        <Builder venueId={venueId} stakes={stakes.data} />
      </Stack>
    </Screen>
  );
}

/**
 * Promotions (#84; design prompt Promotions, flow 7): what is running, paused and resumed in place,
 * and the builder's four blocks with the player card and the TV slide previewed beside them. Publish
 * puts the promotion live at once. For staff who manage promotions.
 */
export function PromotionsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('promotions.manage')) {
    return <Screen title={t('console.promotions.title')} status="error" errorText={t('console.promotions.notAllowed')} />;
  }
  return <PromotionsBody venueId={staff.venue.venueId} />;
}
