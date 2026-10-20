import { zodResolver } from '@hookform/resolvers/zod';
import { CONTROL_LEVELS, engageControlSchema, indianMobileSchema, KILLABLE_FEATURES } from '@rivr/contracts';
import { useControlActions, type ControlFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import type { z } from 'zod';

type EngageInput = z.input<typeof engageControlSchema>;
type EngageValues = z.output<typeof engageControlSchema>;

/** The target a level needs: a feature, or a member or staff member by mobile number. */
function Target({ control, level, phoneError }: { control: Control<EngageInput, unknown, EngageValues>; level: EngageInput['level']; phoneError: boolean }) {
  if (level === 'feature_kill') {
    return (
      <Controller control={control} name="feature" render={({ field }) => (
        <ChoiceChips label={t('console.killSwitch.feature')} mode="one" selected={field.value === null ? [] : [field.value]}
          options={KILLABLE_FEATURES.map((value) => ({ value, label: t(`console.killSwitch.features.${value}`) }))} onChange={([chosen]) => field.onChange(chosen ?? null)} />
      )} />
    );
  }
  if (level !== 'member_freeze' && level !== 'access_revoke') return null;
  const label = level === 'member_freeze' ? t('console.killSwitch.memberPhone') : t('console.killSwitch.staffPhone');
  return (
    <Controller control={control} name="phone" render={({ field }) => (
      <Input type="tel" label={label} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" value={field.value} onChange={field.onChange}
        error={phoneError ? t('console.killSwitch.invalidPhone') : undefined} />
    )} />
  );
}

/** What is about to be engaged, and its effect, before it is: a freeze takes two super admins to undo. */
function Confirm({ values, isPending, onConfirm, onCancel }: { values: EngageValues; isPending: boolean; onConfirm: () => void; onCancel: () => void }) {
  const level = values.level ?? 'venue_freeze';
  return (
    <Stack gap={3}>
      <Text>{t('console.killSwitch.confirm', { level: t(`console.killSwitch.levels.${level}`) })}</Text>
      <Text tone="muted">{level === 'venue_freeze' ? t('console.killSwitch.confirmFreeze') : t('console.killSwitch.confirmOther')}</Text>
      <Inline gap={3}>
        <Button variant="danger" isLoading={isPending} onClick={onConfirm}>{t('console.killSwitch.engageLevel', { level: t(`console.killSwitch.levels.${level}`) })}</Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** Engages a control (#27): a level chosen on purpose, its target when it has one, why, and a confirmation. */
export function EngageForm({ venueId, onOutcome }: { venueId: string; onOutcome: (outcome: 'engaged' | ControlFailure) => void }) {
  const { engage } = useControlActions(venueId);
  const [resolver] = useState(() => zodResolver(engageControlSchema));
  const form = useForm<EngageInput, unknown, EngageValues>({ resolver, defaultValues: { level: null, feature: null, phone: '', reason: '' } });
  const level = useWatch({ control: form.control, name: 'level' });
  const [confirming, setConfirming] = useState<EngageValues | null>(null);
  const engageNow = async (values: EngageValues) => {
    const phone = indianMobileSchema.safeParse(values.phone);
    const done = await engage.mutateAsync({
      level: values.level ?? 'venue_freeze', reason: values.reason, feature: values.level === 'feature_kill' ? values.feature : null,
      memberPhone: values.level === 'member_freeze' && phone.success ? phone.data : null, staffPhone: values.level === 'access_revoke' && phone.success ? phone.data : null,
    });
    onOutcome(done.ok ? 'engaged' : done.error);
    setConfirming(null);
    if (done.ok) form.reset({ level: null, feature: null, phone: '', reason: '' });
  };
  const { errors } = form.formState;
  const reason = form.register('reason');
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.killSwitch.newControl')}</Heading>
      <Controller control={form.control} name="level" render={({ field }) => (
        <ChoiceChips label={t('console.killSwitch.level')} mode="one" selected={field.value === null ? [] : [field.value]}
          options={CONTROL_LEVELS.map((value) => ({ value, label: t(`console.killSwitch.levels.${value}`) }))}
          onChange={([chosen]) => { field.onChange(chosen ?? null); form.setValue('phone', ''); form.setValue('feature', null); setConfirming(null); }} />
      )} />
      <Target control={form.control} level={level} phoneError={errors.phone !== undefined} />
      <Input {...reason} label={t('console.killSwitch.reason')} hint={t('console.killSwitch.reasonHint')} maxLength={500} autoComplete="off"
        error={errors.reason ? t('console.killSwitch.invalidReason') : undefined} />
      {errors.level || errors.feature ? <ErrorMessage>{t('console.killSwitch.chooseTarget')}</ErrorMessage> : null}
      {confirming === null ? (
        <Button variant="secondary" onClick={() => void form.handleSubmit(setConfirming)()}>{t('console.killSwitch.engage')}</Button>
      ) : <Confirm values={confirming} isPending={engage.isPending} onConfirm={() => void engageNow(confirming)} onCancel={() => setConfirming(null)} />}
    </Stack>
  );
}
