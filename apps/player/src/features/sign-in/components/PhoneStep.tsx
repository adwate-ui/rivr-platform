import { zodResolver } from '@hookform/resolvers/zod';
import { indianMobileSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Input, StepScreen, Wordmark } from '@rivr/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';

const phoneForm = z.object({ phone: indianMobileSchema });

/** The first step: the lockup and the motto, then the mobile number to send a code to. */
export function PhoneStep({ onCodeSent }: { onCodeSent: (phone: IndianMobile) => void }) {
  const { requestCode } = useSignIn();
  const form = useForm<z.input<typeof phoneForm>, unknown, z.output<typeof phoneForm>>({ resolver: zodResolver(phoneForm) });

  const send = form.handleSubmit(async ({ phone }) => {
    const sent = await requestCode.mutateAsync({ phone });
    if (sent.ok) onCodeSent(phone);
    else form.setError('phone', { type: 'server', message: t(FAILURE_COPY[sent.error]) });
  });

  const { errors } = form.formState;
  // A refusal from Auth carries its own words; anything else failed the number check.
  const error = errors.phone ? (errors.phone.type === 'server' ? errors.phone.message : t('player.signIn.phoneInvalid')) : undefined;
  return (
    <StepScreen
      align="center"
      onSubmit={send}
      footer={
        <>
          <Input {...form.register('phone')} label={t('player.signIn.phoneLabel')} variant="line" prefix={t('player.signIn.countryCode')} type="tel" inputMode="tel" autoComplete="tel-national" autoFocus error={error} />
          <Button variant="primary" type="submit" fullWidth isLoading={requestCode.isPending}>
            {t('player.signIn.sendCode')}
          </Button>
        </>
      }
    >
      <Wordmark size="lg" withTagline withMotto align="center" />
    </StepScreen>
  );
}
