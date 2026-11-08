import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Inline, Input, Segmented, Stack, Text } from '@rivr/ui';
import { FormInput, type SectionProps } from './BuilderCard.tsx';
import type { HourStepFields } from './builderForm.ts';

// Two to six set steps (the contracts' hourSteps): the first is the form's own fields.
const MOST_STEPS = 6;

/**
 * A step after the first: its bonus chips and hours played, and Remove on the last. Steps keep their places (the owner,
 * 9 Nov: "Lock step count"), so a step is added or removed only at the end.
 */
function MoreStep({ section, step, at, isLast }: { section: SectionProps; step: HourStepFields; at: number; isLast: boolean }) {
  const { form, onChange, isReadOnly } = section;
  const change = (next: Partial<HourStepFields>) => onChange({ ...form, moreSteps: form.moreSteps.map((one, index) => (index === at ? { ...one, ...next } : one)) });
  return (
    <Grid columns={2} gap={4} stackBelow="medium">
      <Input label={t('console.promotions.builder.fields.stepChips')} suffix={t('console.promotions.builder.fields.chipsSuffix')} inputMode="numeric"
        value={step.chips} readOnly={isReadOnly} onChange={(event) => change({ chips: event.target.value })} />
      {/* The field as wide as its column, as the first step's; Remove on its own line under it. */}
      <Stack gap={1}>
        <Input label={t('console.promotions.builder.fields.afterHours')} suffix={t('console.promotions.builder.fields.afterSuffix')} inputMode="decimal"
          value={step.afterHours} readOnly={isReadOnly} onChange={(event) => change({ afterHours: event.target.value })} />
        {isReadOnly || !isLast ? null : (
          <Inline>
            <Button variant="text" size="small" onClick={() => onChange({ ...form, moreSteps: form.moreSteps.filter((_, index) => index !== at) })}>
              {t('console.promotions.builder.fields.removeStep', { step: String(at + 2) })}
            </Button>
          </Inline>
        )}
      </Stack>
    </Grid>
  );
}

/** At set times: the first step's chips and hours, the steps after it, and Add a step up to six. */
function SetSteps({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly, errors } = section;
  const last = form.moreSteps.at(-1) ?? { afterHours: form.afterHours, chips: form.chips };
  const next = { afterHours: String((Number(last.afterHours) || 0) + 2), chips: last.chips };
  const isRefused = errors.has('steps');
  return (
    <Stack gap={4}>
      <Grid columns={2} gap={4} stackBelow="medium">
        <FormInput section={section} field="chips" label={t('console.promotions.builder.fields.chips')} suffix={t('console.promotions.builder.fields.chipsSuffix')}
          inputMode="numeric" />
        <FormInput section={section} field="afterHours" label={t('console.promotions.builder.fields.afterHours')}
          suffix={t('console.promotions.builder.fields.afterSuffix')} inputMode="decimal" />
      </Grid>
      {form.moreSteps.map((step, at) => <MoreStep key={String(at)} section={section} step={step} at={at} isLast={at === form.moreSteps.length - 1} />)}
      {isReadOnly ? null : <Text variant="small" tone="muted">{t('console.promotions.builder.fields.stepsKeepPlace')}</Text>}
      {isRefused ? <ErrorMessage>{t('console.promotions.builder.errors.steps')}</ErrorMessage> : null}
      {isReadOnly || form.moreSteps.length + 1 >= MOST_STEPS ? null : (
        <Stack align="start">
          <Button variant="subtle" size="small" onClick={() => onChange({ ...form, moreSteps: [...form.moreSteps, next] })}>
            {t('console.promotions.builder.fields.addStep')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

/** Every so often: the chips, how often, and up to how many times a visit. */
function EverySoOften({ section }: { section: SectionProps }) {
  return (
    <Grid columns={2} gap={4} stackBelow="medium">
      <FormInput section={section} field="chips" label={t('console.promotions.builder.fields.chips')} suffix={t('console.promotions.builder.fields.chipsSuffix')}
        inputMode="numeric" />
      <FormInput section={section} field="everyHours" label={t('console.promotions.builder.fields.everyHours')}
        suffix={t('console.promotions.builder.fields.afterSuffix')} inputMode="decimal" />
      <FormInput section={section} field="timesPerVisit" label={t('console.promotions.builder.fields.timesPerVisit')}
        inputMode="numeric" placeholder={t('console.promotions.builder.fields.noCap')} />
    </Grid>
  );
}

/**
 * A play-time bonus's fields (owner, 8 Nov): paid at set times, one step to six, or every so often with an optional cap a
 * visit. Each step is paid as it is reached while the member plays.
 */
export function HoursBonusFields({ section }: { section: SectionProps }) {
  const { form, onChange, isReadOnly } = section;
  const pays = t('console.promotions.builder.fields.hoursMode');
  const modes = [
    { value: 'steps' as const, label: t('console.promotions.builder.fields.hoursSteps') },
    { value: 'every' as const, label: t('console.promotions.builder.fields.hoursEvery') },
  ];
  return (
    <Stack gap={4}>
      <Stack gap={2} align="start">
        <Text as="span" variant="label">{pays}</Text>
        <Segmented label={pays} size="small" value={form.hoursMode} options={modes}
          onChange={(hoursMode) => { if (!isReadOnly) onChange({ ...form, hoursMode }); }} />
      </Stack>
      {form.hoursMode === 'every' ? <EverySoOften section={section} /> : <SetSteps section={section} />}
    </Stack>
  );
}
