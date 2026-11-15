import { HIGH_HANDS, type HighHand } from '@rivr/contracts/promotionModel';
import { formatListedHand, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Grid, Inline, Input, Stack, Switch } from '@rivr/ui';
import { BuilderCard, FormInput, type SectionProps } from './BuilderCard.tsx';
import type { HandFields } from './builderForm.ts';

const BUDGET_PERIODS = ['whole', 'month'] as const;

/** A listed hand on a line: its Bonus, typed, and Remove beside it while more than one is listed. */
function HandRow({ section, listed }: { section: SectionProps; listed: HandFields }) {
  const { form, onChange, isReadOnly } = section;
  const name = formatListedHand(listed.hand);
  const change = (chips: string) => onChange({ ...form, hands: form.hands.map((one) => (one.hand === listed.hand ? { ...one, chips } : one)) });
  return (
    <Inline gap={3} align="end">
      <Stack grow gap={0}>
        <Input label={name} suffix={t('console.promotions.builder.fields.bonusSuffix')} inputMode="numeric" value={listed.chips} readOnly={isReadOnly}
          onChange={(event) => change(event.target.value)} />
      </Stack>
      {isReadOnly || form.hands.length < 2 ? null : (
        <Button variant="text" size="small" aria-label={t('console.promotions.builder.fields.removeHand', { hand: name })}
          onClick={() => onChange({ ...form, hands: form.hands.filter((one) => one.hand !== listed.hand) })}>
          {t('console.promotions.builder.fields.remove')}
        </Button>
      )}
    </Inline>
  );
}

/** The hands of the fixed list not yet listed, each a press away: added with its Bonus still to type, in the list's own order. */
function AddHand({ section }: { section: SectionProps }) {
  const { form, onChange } = section;
  const left = HIGH_HANDS.filter((hand) => !form.hands.some((one) => one.hand === hand));
  if (left.length === 0) return null;
  const add = (hand: HighHand | undefined) => {
    if (hand === undefined) return;
    const hands = [...form.hands, { hand, chips: '' }];
    onChange({ ...form, hands: HIGH_HANDS.flatMap((one) => hands.filter((listed) => listed.hand === one)) });
  };
  return (
    <ChoiceChips label={t('console.promotions.builder.fields.addHand')} look="subtle" mode="many" selected={[]}
      options={left.map((hand) => ({ value: hand, label: formatListedHand(hand) }))} onChange={([hand]) => add(hand)} />
  );
}

/** The three rules: both hole cards, shown at showdown, and the least players dealt in. */
function Rules({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  return (
    <Stack gap={3}>
      <Switch label={t('console.promotions.builder.fields.bothHoleCards')} isOn={form.bothHoleCards} isDisabled={isReadOnly}
        onChange={(bothHoleCards) => onChange({ ...form, bothHoleCards })} />
      <Switch label={t('console.promotions.builder.fields.shownAtShowdown')} isOn={form.shownAtShowdown} isDisabled={isReadOnly}
        onChange={(shownAtShowdown) => onChange({ ...form, shownAtShowdown })} />
      <Grid columns={2} gap={4} stackBelow="medium">
        <FormInput section={section} field="minPlayers" label={t('console.promotions.builder.fields.minPlayers')}
          suffix={t('console.promotions.builder.fields.minPlayersSuffix')} inputMode="numeric" />
      </Grid>
    </Stack>
  );
}

/**
 * A high hand's fields (redesign RD-23): hands from the fixed list, each with its Bonus typed, added and removed; then its
 * three rules. A listed hand always has a Bonus: the terms refuse one without.
 */
export function HighHandFields({ section }: { section: SectionProps }) {
  const { form, errors, isReadOnly } = section;
  const isRefused = errors.has('hands');
  return (
    <Stack gap={4}>
      <Stack gap={3}>
        {form.hands.map((listed) => <HandRow key={listed.hand} section={section} listed={listed} />)}
      </Stack>
      {isRefused ? <ErrorMessage>{t('console.promotions.builder.errors.hands')}</ErrorMessage> : null}
      {isReadOnly ? null : <AddHand section={section} />}
      <Rules section={section} />
    </Stack>
  );
}

/**
 * 4 · Limits, for a high hand: its budget alone, which it must have, for the whole promotion or each month. It is paid
 * every time, so there is no limit a member or a day.
 */
export function HighHandLimits({ section }: { section: SectionProps }) {
  const { form, errors, onChange, isReadOnly } = section;
  const periods = BUDGET_PERIODS.map((period) => ({ value: period, label: t(`console.promotions.builder.fields.budgetPeriods.${period}`) }));
  return (
    <BuilderCard label={t('console.promotions.builder.sections.limits')} isChanged={section.isChanged}>
      <Grid columns={2} gap={4} stackBelow="medium">
        <Input label={t('console.promotions.builder.fields.budget')} suffix={t('console.promotions.builder.fields.bonusSuffix')} inputMode="numeric"
          value={form.budgetChips} readOnly={isReadOnly} error={errors.has('budgetChips') ? t('console.promotions.builder.errors.budgetNeeded') : undefined}
          onChange={(event) => onChange({ ...form, budgetChips: event.target.value })} />
        <ChoiceChips label={t('console.promotions.builder.fields.budgetPeriod')} mode="one" look="subtle" selected={[form.budgetPeriod]}
          options={isReadOnly ? periods.filter((period) => period.value === form.budgetPeriod) : periods}
          onChange={(picked) => onChange({ ...form, budgetPeriod: BUDGET_PERIODS.find((period) => period === picked[0]) ?? form.budgetPeriod })} />
      </Grid>
    </BuilderCard>
  );
}
