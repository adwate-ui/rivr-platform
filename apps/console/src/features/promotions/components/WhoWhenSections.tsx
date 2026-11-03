import { AUDIENCES } from '@rivr/contracts/promotionModel';
import type { PromotionStake, VenueTier } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Grid, Inline, Stack } from '@rivr/ui';
import { BuilderCard, FormInput, offered, type SectionProps } from './BuilderCard.tsx';
import { EVERY_DAY } from './builderForm.ts';

// The chip for every stake or every tier: a value no stake code or tier id takes.
const ALL = '*';

/**
 * Every stake (or tier) or the ones picked: picking All picks every one, picking one leaves All, and leaving none picks
 * All again.
 */
export function allOrPicked(picked: readonly string[], before: 'all' | readonly string[]): 'all' | string[] {
  const chosen = picked.filter((value) => value !== ALL);
  return (before !== 'all' && picked.includes(ALL)) || chosen.length === 0 ? 'all' : chosen;
}

const shownOf = (value: 'all' | readonly string[]) => (value === 'all' ? [ALL] : value);

/**
 * 2 · Who qualifies: stakes, tiers and which members. Women members is offered only to a version that already names them:
 * the club records no gender, so it matches nobody (decisions 0438 and 0464).
 */
export function WhoSection({ section, stakes, tiers }: { section: SectionProps; stakes: readonly PromotionStake[]; tiers: readonly VenueTier[] }) {
  const { form, onChange } = section;
  const audiences = AUDIENCES.filter((audience) => audience !== 'women' || form.audience === 'women');
  const isRefused = section.errors.has('who');
  const stakeOptions = [{ value: ALL, label: t('console.promotions.builder.fields.allStakes') }, ...stakes.map((stake) => ({ value: stake.code, label: stake.name }))];
  const tierOptions = [{ value: ALL, label: t('console.promotions.builder.fields.allTiers') }, ...tiers.map((tier) => ({ value: tier.tierId, label: tier.name }))];
  const audienceOptions = audiences.map((audience) => ({ value: audience, label: t(`console.promotions.builder.fields.audiences.${audience}`) }));
  return (
    <BuilderCard label={t('console.promotions.builder.sections.who')} isChanged={section.isChanged}>
      <ChoiceChips label={t('console.promotions.builder.fields.stakes')} look="subtle" selected={shownOf(form.stakes)}
        options={offered(section, stakeOptions, shownOf(form.stakes))}
        onChange={(picked) => onChange({ ...form, stakes: allOrPicked(picked, form.stakes) })} />
      <ChoiceChips label={t('console.promotions.builder.fields.tiers')} look="subtle" selected={shownOf(form.tiers)}
        options={offered(section, tierOptions, shownOf(form.tiers))}
        onChange={(picked) => onChange({ ...form, tiers: allOrPicked(picked, form.tiers) })} />
      <ChoiceChips label={t('console.promotions.builder.fields.audience')} mode="one" look="subtle" selected={[form.audience]}
        options={offered(section, audienceOptions, [form.audience])}
        onChange={(picked) => onChange({ ...form, audience: AUDIENCES.find((audience) => audience === picked[0]) ?? form.audience })} />
      {isRefused ? <ErrorMessage>{t('console.promotions.builder.errors.who')}</ErrorMessage> : null}
    </BuilderCard>
  );
}

// ISO days, Monday first, as the catalogue names them.
const DAYS = [['1', 'mon'], ['2', 'tue'], ['3', 'wed'], ['4', 'thu'], ['5', 'fri'], ['6', 'sat'], ['7', 'sun']] as const;

/** The days picked, in the week's order. */
const daysOf = (picked: readonly string[]) => EVERY_DAY.filter((day) => picked.includes(String(day)));

/** 3 · When: the days with Every day, from and to on the club's clock, and the first and last days. */
export function WhenSection({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  const clock = t('console.promotions.builder.fields.timePlaceholder');
  const days = DAYS.map(([day, key]) => ({ value: day, label: t(`console.promotions.builder.fields.dayNames.${key}`) }));
  const isRefused = section.errors.has('days');
  return (
    <BuilderCard label={t('console.promotions.builder.sections.when')} isChanged={section.isChanged}>
      <Stack gap={2}>
        <Inline gap={2} align="center" wrap>
          <ChoiceChips label={t('console.promotions.builder.fields.days')} isLabelVisuallyHidden look="subtle" selected={form.days.map(String)}
            options={offered(section, days, form.days.map(String))}
            onChange={(picked) => onChange({ ...form, days: daysOf(picked) })} />
          {isReadOnly ? null : (
            <Button variant="text" size="small" onClick={() => onChange({ ...form, days: EVERY_DAY })}>{t('console.promotions.builder.fields.everyDay')}</Button>
          )}
        </Inline>
        {isRefused ? <ErrorMessage>{t('console.promotions.builder.errors.days')}</ErrorMessage> : null}
      </Stack>
      <Grid columns={2} gap={4}>
        <FormInput section={section} field="from" label={t('console.promotions.builder.fields.from')} placeholder={clock} />
        <FormInput section={section} field="to" label={t('console.promotions.builder.fields.to')} placeholder={clock} />
        <FormInput section={section} field="startsOn" label={t('console.promotions.builder.fields.startsOn')} type="date" />
        <FormInput section={section} field="endsOn" label={t('console.promotions.builder.fields.endsOn')} type="date" />
      </Grid>
    </BuilderCard>
  );
}
