import { zodResolver } from '@hookform/resolvers/zod';
import { signInCodeSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, CodeInput, StepScreen, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';
import { ResendButton } from './ResendButton.tsx';

const codeForm = z.object({ code: signInCodeSchema });

/**
 * The second step: where the code went, and its six digits, which go on by themselves once all are in, typed or filled
 * from the message (S-01); or a new code by SMS once a minute has passed.
 */
export function CodeStep({ phone, onBack, onSignedIn }: { phone: IndianMobile; onBack: () => void; onSignedIn: () => void }) {
  const { verifyCode } = useSignIn();
  const [isResent, setIsResent] = useState(false);
  const form = useForm<z.input<typeof codeForm>>({ resolver: zodResolver(codeForm), defaultValues: { code: '' } });
  const fail = (failure: SignInFailure) => form.setError('code', { type: 'server', message: t(FAILURE_COPY[failure]) });

  const verify = form.handleSubmit(async ({ code }) => {
    const signedIn = await verifyCode.mutateAsync({ phone, code });
    if (signedIn.ok) onSignedIn();
    else fail(signedIn.error);
  });

  const { errors } = form.formState;
  // A refusal from Auth carries its own words; anything else failed the six-digit check.
  const error = errors.code ? (errors.code.type === 'server' ? errors.code.message : t('common.signIn.codeInvalid')) : undefined;
  const hasSixDigits = signInCodeSchema.safeParse(useWatch({ control: form.control, name: 'code' })).success;
  return (
    <StepScreen
      title={t('common.signIn.codeTitle')}
      // Not while the code is being checked: going back mid-check would lose its outcome (#227).
      back={verifyCode.isPending ? undefined : { label: t('common.signIn.changeNumber'), onBack }}
      onSubmit={verify}
      footer={
        <>
          <Button variant="primary" size="large" type="submit" fullWidth isDisabled={!hasSixDigits} isLoading={verifyCode.isPending}>
            {t('common.signIn.submit')}
          </Button>
          <ResendButton phone={phone} onSent={() => setIsResent(true)} onFail={fail} />
        </>
      }
    >
      <Text tone="muted">{t(isResent ? 'common.signIn.codeSentBySms' : 'common.signIn.codeSent', { phone: formatMobile(phone) })}</Text>
      <Controller control={form.control} name="code" render={({ field }) => (
        <CodeInput ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} label={t('common.signIn.codeLabel')} autoFocus
          isDisabled={verifyCode.isPending} error={error} onComplete={() => void verify()} />
      )} />
    </StepScreen>
  );
}
