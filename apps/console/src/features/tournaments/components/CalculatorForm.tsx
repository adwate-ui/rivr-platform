import { zodResolver } from '@hookform/resolvers/zod';
import { structurePlanSchema } from '@rivr/contracts/tournaments';
import { planStructure, type Stage } from '@rivr/domain/tournament';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

type PlanValues = z.input<typeof structurePlanSchema>;
type PlanField = Exclude<keyof PlanValues, 'hasAnte'>;

const DEFAULTS: PlanValues = {
  startingStack: '30000', expectedEntries: '60', firstBigBlind: '200', levelMinutes: '20', targetHours: '8', breakEvery: '4', breakMinutes: '10', hasAnte: true,
};

const FIELDS: readonly { name: PlanField; label: MessageKey; hint?: MessageKey }[] = [
  { name: 'startingStack', label: 'console.tournaments.stack' },
  { name: 'expectedEntries', label: 'console.tournaments.expectedEntries' },
  { name: 'firstBigBlind', label: 'console.tournaments.firstBigBlind' },
  { name: 'levelMinutes', label: 'console.tournaments.levelMinutes' },
  { name: 'targetHours', label: 'console.tournaments.targetHours' },
  { name: 'breakEvery', label: 'console.tournaments.breakEvery', hint: 'console.tournaments.breakEveryHint' },
  { name: 'breakMinutes', label: 'console.tournaments.breakMinutes' },
];

/**
 * The blind-structure calculator (#115, decision 0200): for a target length, it plans the levels and hands
 * them to the editor (`onPlan`), where the floor may change any of them.
 */
export function CalculatorForm({ onPlan }: { onPlan: (stages: Stage[]) => void }) {
  const [resolver] = useState(() => zodResolver(structurePlanSchema));
  const form = useForm<PlanValues, unknown, z.output<typeof structurePlanSchema>>({ resolver, defaultValues: DEFAULTS });
  const hasErrors = Object.keys(form.formState.errors).length > 0;
  const plan = form.handleSubmit((values) => onPlan(planStructure({ ...values, targetMinutes: values.targetHours })));
  return (
    <Stack gap={4}>
      <Heading level={3} variant="subsection">{t('console.tournaments.calculator')}</Heading>
      <Text variant="small" tone="muted">{t('console.tournaments.calculatorHint')}</Text>
      <Inline gap={4} align="start" wrap>
        {FIELDS.map((field) => (
          <Input key={field.name} {...form.register(field.name)} label={t(field.label)} hint={field.hint === undefined ? undefined : t(field.hint)}
            inputMode="decimal" autoComplete="off" error={form.formState.errors[field.name] ? t('console.tournaments.invalidPlan') : undefined} />
        ))}
      </Inline>
      <Controller control={form.control} name="hasAnte" render={({ field }) => (
        <Switch label={t('console.tournaments.ante')} isOn={field.value} onChange={field.onChange} />
      )} />
      <Inline gap={4} align="center">
        <Button variant="secondary" onClick={() => void plan()}>{t('console.tournaments.calculate')}</Button>
        {hasErrors ? <Text tone="muted">{t('console.tournaments.invalidPlan')}</Text> : null}
      </Inline>
    </Stack>
  );
}
