import { zodResolver } from '@hookform/resolvers/zod';
import { panSchema } from '@rivr/contracts';
import { useKycActions, useSignOut, type KycFailure } from '@rivr/db';
import { formatTypedDay, isoDayOfTyped, t } from '@rivr/i18n';
import { Button, ErrorMessage, Input, Stack, StepScreen } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/** The PAN form. The date of birth is asked for only when DigiLocker gave none. */
function panForm(knowsDateOfBirth: boolean) {
  return z
    .object({ pan: z.string().toUpperCase().pipe(panSchema), dateOfBirth: z.string() })
    .superRefine(({ dateOfBirth }, context) => {
      // Typed as DD / MM / YYYY in a numeric field (decision 0320), not the browser's mm/dd/yyyy picker.
      if (!knowsDateOfBirth && isoDayOfTyped(dateOfBirth) === null) {
        context.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'required' });
      }
    });
}
type PanForm = ReturnType<typeof panForm>;

/**
 * Back to DigiLocker, for a member it failed once or who left it: the first screen's start, which the kyc function
 * allows from the PAN step, so the member need not wait for staff at the club.
 */
function DigilockerAgain() {
  const { start } = useKycActions();
  const [failure, setFailure] = useState<KycFailure | null>(null);
  const begin = async () => {
    const started = await start.mutateAsync();
    if (started.ok) window.location.assign(started.value);
    else setFailure(started.error);
  };
  return (
    <Stack gap={2}>
      <Button variant="text" fullWidth isLoading={start.isPending} onClick={() => void begin()}>{t('player.kyc.tryDigilockerAgain')}</Button>
      {failure ? <ErrorMessage look="dot">{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
    </Stack>
  );
}

/** As every other step: the member can sign out, hand the phone over or come back later (audit F-057). */
function StepSignOut() {
  const signOut = useSignOut();
  return <Button variant="text" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>{t('common.signIn.signOut')}</Button>;
}

/**
 * The PAN check, when DigiLocker failed or held no PAN. The PAN is checked against the name the club
 * registered, so there is no name to type. When DigiLocker failed, which left no date of birth, DigiLocker again is
 * offered below it. A member it matched but who has no PAN in it is not: a second try that failed would send their PAN
 * to staff, where it would have verified them.
 */
export function PanStep({ knowsDateOfBirth, onChecked }: { knowsDateOfBirth: boolean; onChecked: () => void }) {
  const { verifyPan } = useKycActions();
  const [resolver] = useState(() => zodResolver(panForm(knowsDateOfBirth)));
  const form = useForm<z.input<PanForm>, unknown, z.output<PanForm>>({ resolver, defaultValues: { pan: '', dateOfBirth: '' } });
  const { errors } = form.formState;

  const verify = form.handleSubmit(async ({ pan, dateOfBirth }) => {
    const checked = await verifyPan.mutateAsync(knowsDateOfBirth ? { pan } : { pan, dateOfBirth: isoDayOfTyped(dateOfBirth) ?? '' });
    if (checked.ok) onChecked();
    else form.setError('pan', { type: 'server', message: t(FAILURE_COPY[checked.error]) });
  });
  // A refusal carries its own words; anything else failed the field's check.
  const panError = errors.pan ? (errors.pan.type === 'server' ? errors.pan.message : t('player.kyc.panInvalid')) : undefined;
  const panField = form.register('pan');
  return (
    <StepScreen
      title={t('player.kyc.panTitle')}
      look={{ subtitle: t(knowsDateOfBirth ? 'player.kyc.panIntro' : 'player.kyc.panAfterDigilocker') }}
      onSubmit={verify}
      footer={
        <Stack gap={3}>
          <Button variant="primary" size="tall" type="submit" fullWidth isLoading={verifyPan.isPending}>
            {t('player.kyc.verify')}
          </Button>
          {knowsDateOfBirth ? null : <DigilockerAgain />}
          <StepSignOut />
        </Stack>
      }
    >
      <Input {...panField} label={t('player.kyc.panLabel')} placeholder={t('player.kyc.panPlaceholder')} autoComplete="off" maxLength={10}
        isTall autoFocus error={panError} />
      {knowsDateOfBirth ? null : (
        <Controller control={form.control} name="dateOfBirth" render={({ field }) => (
          <Input ref={field.ref} name={field.name} value={field.value} onBlur={field.onBlur} onChange={(event) => field.onChange(formatTypedDay(event.target.value))}
            label={t('player.kyc.dateOfBirthLabel')} placeholder={t('player.kyc.dateOfBirthPlaceholder')} inputMode="numeric" autoComplete="bday"
            isTall error={errors.dateOfBirth ? t('player.kyc.dateOfBirthInvalid') : undefined} />
        )} />
      )}
    </StepScreen>
  );
}
