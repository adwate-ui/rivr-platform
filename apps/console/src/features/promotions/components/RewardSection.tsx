import { BONUS_CHIPS_ON } from '@rivr/contracts/promotionModel';
import { t } from '@rivr/i18n';
import { ChoiceChips, Grid, Segmented, Stack, Text } from '@rivr/ui';
import type { ReactNode } from 'react';
import { BuilderCard, FormInput, offered, type SectionProps } from './BuilderCard.tsx';
import { REWARD_KINDS } from './builderForm.ts';

/** A choice of two to four with its label shown above it, as the prototype's "Bonus as" and "Given on". */
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2} align="start">
      <Text as="span" variant="label">{label}</Text>
      {children}
    </Stack>
  );
}

/** The typed fields of a reward, two a row from 768 px. */
function Fields({ children }: { children: ReactNode }) {
  return <Grid columns={2} gap={4} stackBelow="medium">{children}</Grid>;
}

/** A count of bonus chips, in its own field. */
function ChipsInput({ section, field, label }: { section: SectionProps; field: 'chips' | 'buyChips' | 'capChips'; label: string }) {
  return <FormInput section={section} field={field} label={label} suffix={t('console.promotions.builder.fields.chipsSuffix')} inputMode="numeric" />;
}

function BuyInFields({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  const isPercent = form.buyMode === 'percent';
  const bonusAs = t('console.promotions.builder.fields.bonusAs');
  const modes = [
    { value: 'percent' as const, label: t('console.promotions.builder.fields.percentMode') },
    { value: 'fixed' as const, label: t('console.promotions.builder.fields.fixedMode') },
  ];
  return (
    <>
      <Labelled label={bonusAs}>
        <Segmented label={bonusAs} size="small" value={form.buyMode} options={modes}
          onChange={(buyMode) => { if (!isReadOnly) onChange({ ...form, buyMode }); }} />
      </Labelled>
      <Fields>
        {isPercent ? (
          <FormInput section={section} field="percent" label={t('console.promotions.builder.fields.percent')}
            suffix={t('console.promotions.builder.fields.percentSuffix')} inputMode="numeric" />
        ) : <ChipsInput section={section} field="buyChips" label={t('console.promotions.builder.fields.buyChips')} />}
        {isPercent ? <ChipsInput section={section} field="capChips" label={t('console.promotions.builder.fields.capChips')} /> : null}
        <FormInput section={section} field="firstN" label={t('console.promotions.builder.fields.firstN')}
          suffix={t('console.promotions.builder.fields.firstNSuffix')} inputMode="numeric" />
      </Fields>
    </>
  );
}

function BonusChipsFields({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  const givenOn = t('console.promotions.builder.fields.givenOn');
  return (
    <>
      <Fields><ChipsInput section={section} field="chips" label={t('console.promotions.builder.fields.chips')} /></Fields>
      <Labelled label={givenOn}>
        <Segmented label={givenOn} size="small" value={form.bonusOn}
          options={BONUS_CHIPS_ON.map((on) => ({ value: on, label: t(`console.promotions.builder.fields.bonusOn.${on}`) }))}
          onChange={(bonusOn) => { if (!isReadOnly) onChange({ ...form, bonusOn }); }} />
      </Labelled>
    </>
  );
}

/** Hours played before an hours bonus or a free spin, in half hours. */
function AfterInput({ section }: { section: SectionProps }) {
  return (
    <FormInput section={section} field="afterHours" label={t('console.promotions.builder.fields.afterHours')}
      suffix={t('console.promotions.builder.fields.afterSuffix')} inputMode="decimal" />
  );
}

/** The fields of the kind chosen; waitlist priority has none. */
function KindFields({ section }: { section: SectionProps }) {
  switch (section.form.kind) {
    case 'points_multiplier':
      return (
        <Fields>
          <FormInput section={section} field="multiplier" label={t('console.promotions.builder.fields.multiplier')}
            suffix={t('console.promotions.builder.fields.multiplierSuffix')} inputMode="decimal" />
        </Fields>
      );
    case 'buyin_bonus':
      return <BuyInFields section={section} />;
    case 'hours_bonus':
      return <Fields><ChipsInput section={section} field="chips" label={t('console.promotions.builder.fields.chips')} /><AfterInput section={section} /></Fields>;
    case 'bonus_chips':
      return <BonusChipsFields section={section} />;
    case 'free_spin':
      return (
        <Fields>
          <FormInput section={section} field="spins" label={t('console.promotions.builder.fields.spins')}
            suffix={t('console.promotions.builder.fields.spinsSuffix')} inputMode="numeric" />
          <AfterInput section={section} />
        </Fields>
      );
    case 'cab_home':
      return (
        <Fields>
          <FormInput section={section} field="fromVisit" label={t('console.promotions.builder.fields.fromVisit')}
            suffix={t('console.promotions.builder.fields.fromVisitSuffix')} inputMode="numeric" />
        </Fields>
      );
    case 'tournament_entry':
      return <Fields><FormInput section={section} field="tournament" label={t('console.promotions.builder.fields.tournament')} /></Fields>;
    default:
      return null;
  }
}

/** 1 · Reward: a card for each kind, then that kind's own fields (the brief: the buy-in bonus has % or Fixed chips). */
export function RewardSection(section: SectionProps) {
  const { form, onChange } = section;
  const kinds = REWARD_KINDS.map((kind) => ({
    value: kind, label: t(`console.promotions.builder.rewards.${kind}.label`), description: t(`console.promotions.builder.rewards.${kind}.description`),
  }));
  return (
    <BuilderCard label={t('console.promotions.builder.sections.reward')} isChanged={section.isChanged}>
      <ChoiceChips label={t('console.promotions.builder.rewardKind')} isLabelVisuallyHidden mode="one" look="card" selected={[form.kind]}
        options={offered(section, kinds, [form.kind])}
        onChange={(picked) => onChange({ ...form, kind: REWARD_KINDS.find((kind) => kind === picked[0]) ?? form.kind })} />
      <KindFields section={section} />
    </BuilderCard>
  );
}
