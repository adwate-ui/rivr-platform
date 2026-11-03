import { zodResolver } from '@hookform/resolvers/zod';
import { indianMobileSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn } from '@rivr/db';
import { formatTypedMobile, t } from '@rivr/i18n';
import { Button, Captcha, Heading, Inline, Input, StepScreen, Text, useCaptcha, Wordmark } from '@rivr/ui';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CAPTCHA_SITE_KEY } from '../captcha.ts';
import { FAILURE_COPY } from './failureCopy.ts';

const phoneForm = z.object({ phone: indianMobileSchema });

/** The legal line, with links to the terms and the privacy notice, pages of the website (#775); alone where the build names no website. */
function LegalLine() {
  const webUrl = import.meta.env.VITE_WEB_URL;
  return (
    <>
      <Text variant="caption" tone="muted" align="center">{t('player.signIn.legal')}</Text>
      {webUrl ? (
        <Inline gap={4} justify="center">
          <Button variant="text" href={`${webUrl}/terms`} opensNewTab>{t('player.signIn.terms')}</Button>
          <Button variant="text" href={`${webUrl}/privacy`} opensNewTab>{t('player.signIn.privacy')}</Button>
        </Inline>
      ) : null}
    </>
  );
}

/**
 * The first step (decision 0320): the lockup, the motto, then at the foot "Sign in or join", the number after +91, spaced
 * as it is typed, Send code and the legal line. A number the club does not know goes on to join once its code is in.
 */
export function PhoneStep({ onCodeSent }: { onCodeSent: (phone: IndianMobile) => void }) {
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
  const error = errors.phone ? (errors.phone.type === 'server' ? errors.phone.message : t('player.signIn.phoneInvalid')) : undefined;
  return (
    <StepScreen
      align="center"
      onSubmit={send}
      footer={
        <>
          <Heading level={1} variant="serif" serifSize={28}>{t('player.signIn.title')}</Heading>
          <Controller control={form.control} name="phone" render={({ field }) => (
            <Input ref={field.ref} name={field.name} value={field.value} onBlur={field.onBlur} onChange={(event) => field.onChange(formatTypedMobile(event.target.value))}
              label={t('player.signIn.phoneLabel')} prefix={t('common.signIn.countryCode')} isTall placeholder={t('player.signIn.phonePlaceholder')}
              type="tel" inputMode="tel" autoComplete="tel-national" error={error} />
          )} />
          <Captcha {...captcha.props} />
          <Button variant="primary" size="tall" type="submit" fullWidth isDisabled={!captcha.isReady} isLoading={requestCode.isPending}>
            {t('player.signIn.sendCode')}
          </Button>
          <LegalLine />
        </>
      }
    >
      <Wordmark size="lg" withTagline withMotto align="center" />
    </StepScreen>
  );
}
