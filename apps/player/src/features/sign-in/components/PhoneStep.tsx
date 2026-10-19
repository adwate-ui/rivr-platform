import { zodResolver } from '@hookform/resolvers/zod';
import { indianMobileSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Captcha, Heading, Input, StepScreen, useCaptcha, Wordmark } from '@rivr/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';
import { FAILURE_COPY } from './failureCopy.ts';

const phoneForm = z.object({ phone: indianMobileSchema });

/** The first step: the lockup and the motto, then the mobile number to send a code to. */
export function PhoneStep({ onCodeSent }: { onCodeSent: (phone: IndianMobile) => void }) {
  const { requestCode } = useSignIn();
  const captcha = useCaptcha(CAPTCHA_SITE_KEY);
  const form = useForm<z.input<typeof phoneForm>, unknown, z.output<typeof phoneForm>>({ resolver: zodResolver(phoneForm) });

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
          <Input {...form.register('phone')} label={t('common.signIn.phoneLabel')} variant="line" prefix={t('common.signIn.countryCode')} type="tel" inputMode="tel" autoComplete="tel-national" autoFocus error={error} />
          <Captcha {...captcha.props} />
          <Button variant="primary" size="large" type="submit" fullWidth isDisabled={!captcha.isReady} isLoading={requestCode.isPending}>
            {t('common.signIn.sendCode')}
          </Button>
        </>
      }
    >
      {/* The wordmark names the screen as an image: its h1 is for screen readers. */}
      <Heading level={1} isVisuallyHidden>{t('common.signIn.title')}</Heading>
      <Wordmark size="lg" withTagline withMotto align="center" />
    </StepScreen>
  );
}
