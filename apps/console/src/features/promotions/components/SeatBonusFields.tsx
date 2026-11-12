import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Inline, Input, Segmented, Stack, Text } from '@rivr/ui';
import { FormInput, type SectionProps } from './BuilderCard.tsx';
import type { SeatTierFields } from './builderForm.ts';

// One to ten tiers (the contracts' seatTiers).
const MOST_TIERS = 10;

/** One tier: how many members it covers and its bonus chips; Remove on the last of two or more, so tiers keep their order. */
function Tier({ section, tier, at, isLast }: { section: SectionProps; tier: SeatTierFields; at: number; isLast: boolean }) {
  const { form, onChange, isReadOnly } = section;
  const number = String(at + 1);
  const change = (next: Partial<SeatTierFields>) => onChange({ ...form, seatTiers: form.seatTiers.map((one, index) => (index === at ? { ...one, ...next } : one)) });
  return (
    <Grid columns={2} gap={4} stackBelow="medium">
      <Input label={at === 0 ? t('console.promotions.builder.fields.tierCountFirst') : t('console.promotions.builder.fields.tierCount', { tier: number })}
        suffix={t('console.promotions.builder.fields.tierCountSuffix')} inputMode="numeric" value={tier.count} readOnly={isReadOnly}
        onChange={(event) => change({ count: event.target.value })} />
      <Stack gap={1}>
        <Input label={t('console.promotions.builder.fields.tierChips', { tier: number })} suffix={t('console.promotions.builder.fields.chipsSuffix')}
          inputMode="numeric" value={tier.chips} readOnly={isReadOnly} onChange={(event) => change({ chips: event.target.value })} />
        {isReadOnly || !isLast || at === 0 ? null : (
          <Inline>
            <Button variant="text" size="small" onClick={() => onChange({ ...form, seatTiers: form.seatTiers.filter((_, index) => index !== at) })}>
              {t('console.promotions.builder.fields.removeTier', { tier: number })}
            </Button>
          </Inline>
        )}
      </Stack>
    </Grid>
  );
}

/** The tiers in order, how they count, and Add a tier up to ten. */
function Tiers({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly, errors } = section;
  const last = form.seatTiers.at(-1) ?? { count: '10', chips: '1000' };
  const isRefused = errors.has('tierList');
  return (
    <Stack gap={4}>
      {form.seatTiers.map((tier, at) => <Tier key={String(at)} section={section} tier={tier} at={at} isLast={at === form.seatTiers.length - 1} />)}
      <Text variant="small" tone="muted">{t('console.promotions.builder.fields.tiersOnce')}</Text>
      {isRefused ? <ErrorMessage>{t('console.promotions.builder.errors.tierList')}</ErrorMessage> : null}
      {isReadOnly || form.seatTiers.length >= MOST_TIERS ? null : (
        <Stack align="start">
          <Button variant="subtle" size="small" onClick={() => onChange({ ...form, seatTiers: [...form.seatTiers, { count: last.count, chips: last.chips }] })}>
            {t('console.promotions.builder.fields.addTier')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * A seat bonus's fields (owner, 8 Nov): one amount on a visit's first seat or the first seats at each table; or in tiers
 * (owner, 12 Nov; decision 0580), the first so many members getting one amount and the next another, once a member.
 */
export function SeatBonusFields({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  const pays = t('console.promotions.builder.fields.seatMode');
  const modes = [
    { value: 'fixed' as const, label: t('console.promotions.builder.fields.seatFixed') },
    { value: 'tiers' as const, label: t('console.promotions.builder.fields.seatTiers') },
  ];
  return (
    <Stack gap={4}>
      <Stack gap={2} align="start">
        <Text as="span" variant="label">{pays}</Text>
        <Segmented label={pays} size="small" value={form.seatMode} options={modes}
          onChange={(seatMode) => { if (!isReadOnly) onChange({ ...form, seatMode }); }} />
      </Stack>
      {form.seatMode === 'tiers' ? <Tiers section={section} /> : (
        <Grid columns={2} gap={4} stackBelow="medium">
          <FormInput section={section} field="chips" label={t('console.promotions.builder.fields.chips')}
            suffix={t('console.promotions.builder.fields.chipsSuffix')} inputMode="numeric" />
          <FormInput section={section} field="firstN" label={t('console.promotions.builder.fields.firstN')}
            suffix={t('console.promotions.builder.fields.firstNSuffix')} inputMode="numeric" />
        </Grid>
      )}
    </Stack>
  );
}
