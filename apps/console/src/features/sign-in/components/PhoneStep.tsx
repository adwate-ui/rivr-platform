import { zodResolver } from '@hookform/resolvers/zod';
import { indianMobileSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn } from '@rivr/db';
import { formatTypedMobile, t } from '@rivr/i18n';
import { Button, Captcha, Heading, Input, StatusMessage, StepScreen, Text, useCaptcha, Wordmark } from '@rivr/ui';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';
import { FAILURE_COPY } from './failureCopy.ts';

const phoneForm = z.object({ phone: indianMobileSchema });

/**
 * The first step: the lockup and the motto, then a staff member's mobile number, spaced as it is typed, and where the
 * code will come (S-01). `notice` says why the staff member is here, such as the idle lock having signed them out (#811).
 */
export function PhoneStep({ onCodeSent, notice }: { onCodeSent: (phone: IndianMobile) => void; notice?: string | undefined }) {
  const { requestCode } = useSignIn();
  const captcha = useCaptcha(CAPTCHA_SITE_KEY);
  const form = useForm<z.input<typeof phoneForm>, unknown, z.output<typeof phoneForm>>({ resolver: zodResolver(phoneForm), defaultValues: { phone: '' } });

  const send = form.handleSubmit(async ({ phone }) => {
    const sent = await requestCode.mutateAsync({ phone, captchaToken: captcha.token });
    // A token is good for one request.
    captcha.renew();
    if (sent.ok) onCodeSent(phone);
    else form.setError('phone', { type: 'server', message: t(FAILURE_COPY[sent.error]) });
  });

  const { errors } = form.formState;
  // A refusal from Auth carries its own words; anything else failed the number check.
  const error = errors.phone ? (errors.phone.type === 'server' ? errors.phone.message : t('common.signIn.phoneInvalid')) : undefined;
  return (
    <StepScreen
      align="center"
      onSubmit={send}
      footer={
        <>
          <Heading level={1} variant="title">{t('common.signIn.title')}</Heading>
          <StatusMessage>{notice}</StatusMessage>
          <Controller control={form.control} name="phone" render={({ field }) => (
            <Input ref={field.ref} name={field.name} value={field.value} onBlur={field.onBlur} onChange={(event) => field.onChange(formatTypedMobile(event.target.value))}
              label={t('common.signIn.phoneLabel')} variant="line" prefix={t('common.signIn.countryCode')} type="tel" inputMode="tel" autoComplete="tel-national"
              autoFocus error={error} />
          )} />
          <Captcha {...captcha.props} />
          <Button variant="primary" size="large" type="submit" fullWidth isDisabled={!captcha.isReady} isLoading={requestCode.isPending}>
            {t('common.signIn.sendCode')}
          </Button>
          <Text variant="small" tone="muted" align="center">{t('common.signIn.channels')}</Text>
        </>
      }
    >
      <Wordmark size="lg" withTagline withMotto align="center" />
    </StepScreen>
  );
}
