import { zodResolver } from '@hookform/resolvers/zod';
import { panSchema } from '@rivr/contracts';
import { useKycActions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Input, StepScreen, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

/** The PAN form. The date of birth is asked for only when DigiLocker gave none. */
function panForm(knowsDateOfBirth: boolean) {
  return z
    .object({ pan: z.string().toUpperCase().pipe(panSchema), dateOfBirth: z.string() })
    .superRefine(({ dateOfBirth }, context) => {
      if (!knowsDateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        context.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'required' });
      }
    });
}
type PanForm = ReturnType<typeof panForm>;

/**
 * The PAN check, when DigiLocker failed or held no PAN. The PAN is checked against the name the club
 * registered, so there is no name to type.
 */
export function PanStep({ knowsDateOfBirth, onChecked }: { knowsDateOfBirth: boolean; onChecked: () => void }) {
  const { verifyPan } = useKycActions();
  const [resolver] = useState(() => zodResolver(panForm(knowsDateOfBirth)));
  const form = useForm<z.input<PanForm>, unknown, z.output<PanForm>>({ resolver, defaultValues: { pan: '', dateOfBirth: '' } });
  const { errors } = form.formState;

  const verify = form.handleSubmit(async ({ pan, dateOfBirth }) => {
    const checked = await verifyPan.mutateAsync(knowsDateOfBirth ? { pan } : { pan, dateOfBirth });
    if (checked.ok) onChecked();
    else form.setError('pan', { type: 'server', message: t(FAILURE_COPY[checked.error]) });
  });
  // A refusal carries its own words; anything else failed the field's check.
  const panError = errors.pan ? (errors.pan.type === 'server' ? errors.pan.message : t('player.kyc.panInvalid')) : undefined;
  const panField = form.register('pan');
  const birthField = form.register('dateOfBirth');
  return (
    <StepScreen
      title={t('player.kyc.panTitle')}
      onSubmit={verify}
      footer={
        <Button variant="primary" type="submit" fullWidth isLoading={verifyPan.isPending}>
          {t('player.kyc.verify')}
        </Button>
      }
    >
      <Text tone="muted">{t('player.kyc.panIntro')}</Text>
      <Input {...panField} label={t('player.kyc.panLabel')} placeholder={t('player.kyc.panPlaceholder')} autoComplete="off" maxLength={10} autoFocus error={panError} />
      {knowsDateOfBirth ? null : (
        <Input {...birthField} label={t('player.kyc.dateOfBirthLabel')} type="date" autoComplete="bday" error={errors.dateOfBirth ? t('player.kyc.dateOfBirthInvalid') : undefined} />
      )}
    </StepScreen>
  );
}
