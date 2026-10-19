import type { Paise } from '@rivr/domain/money';
import type { PotTake } from '@rivr/domain/rake';
import { formatMoney, t } from '@rivr/i18n';
import { Grid, Money, Stack, Text } from '@rivr/ui';

/** One amount under its name, with a line beneath when there is one. */
function Figure({ label, paise, note }: { label: string; paise: Paise; note?: string | undefined }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{label}</Text>
      <Money paise={paise} size="title" />
      {note === undefined ? null : <Text variant="small" tone="muted">{note}</Text>}
    </Stack>
  );
}

/**
 * The pot as typed and what the dealer pulls from it, as in the prototype: the rake (and the cap,
 * when the cap set it), the jackpot drop and the pull, the two together.
 */
export function TakeSummary({ pot, take, cap }: { pot: Paise; take: PotTake; cap: Paise }) {
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Text variant="label" tone="muted">{t('tablet.handEntry.pot')}</Text>
        <Money paise={pot} size="display" />
      </Stack>
      <Grid columns={3} gap={4}>
        <Figure label={t('tablet.handEntry.rake')} paise={take.rake}
          note={take.isCapApplied ? t('tablet.handEntry.capped', { amount: formatMoney(cap) }) : undefined} />
        <Figure label={t('tablet.handEntry.drop')} paise={take.drop} />
        <Figure label={t('tablet.handEntry.pull')} paise={take.pull} />
      </Grid>
    </Stack>
  );
}
