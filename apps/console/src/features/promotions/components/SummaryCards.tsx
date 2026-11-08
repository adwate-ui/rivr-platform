import type { Terms } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Box, DisplayPreview, Stack, Text, TvPromotionSlide } from '@rivr/ui';
import { cardWords, describePromotion, type PromotionNames } from './promotionWords.ts';

interface SummaryCardsProps {
  /** The name members see, or the reward's kind until one is typed. */
  title: string;
  /** The four parts of the terms when they hold, or null while a field is marked. */
  core: Terms | null;
  names: PromotionNames;
  /** The approver's view: the running version's one line beside the new one, under its own label. */
  before?: { readonly label: string; readonly core: Terms } | undefined;
}

/** One line, gold-edged: what the approver reads (`describePromotion`). */
function OneLine({ label, line }: { label: string; line: string }) {
  return (
    <Box surface="raised" hairline="all" radius="lg" padding={4}>
      <Stack gap={2}>
        <Text variant="eyebrow" tone="accent">{label}</Text>
        <Text variant="row">{line}</Text>
      </Stack>
    </Box>
  );
}

/**
 * The top of the builder's right column (console v3): the promotion in one line, and the TV slide as the TV will show it,
 * both from the terms as they stand.
 */
export function SummaryCards({ title, core, names, before }: SummaryCardsProps) {
  const words = core === null ? null : cardWords(core, names);
  return (
    <>
      {before === undefined ? null : <OneLine label={before.label} line={describePromotion(before.core, names)} />}
      <OneLine label={t('console.promotions.builder.inOneLine')}
        line={core === null ? t('console.promotions.builder.incomplete') : describePromotion(core, names)} />
      <DisplayPreview label={t('console.promotions.builder.tvSlide')}>
        <TvPromotionSlide level={2} label={t('console.promotions.slideLabel')} title={title} detail={words?.detail} when={words?.runs} />
      </DisplayPreview>
    </>
  );
}
