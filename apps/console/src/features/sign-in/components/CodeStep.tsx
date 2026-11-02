import { zodResolver } from '@hookform/resolvers/zod';
import { signInCodeSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, CodeInput, StepScreen, Wordmark } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';
import { ResendButton } from './ResendButton.tsx';

const codeForm = z.object({ code: signInCodeSchema });

/** The six cells, checked as soon as the sixth digit is in; the label says where the code went. */
function CodeField({ control, error, label, onComplete }: {
  control: Control<z.input<typeof codeForm>>; error: string | undefined; label: string; onComplete: () => void;
}) {
  return (
    <Controller control={control} name="code" render={({ field }) => (
      <CodeInput ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} autoFocus error={error} onComplete={onComplete}
        label={label} />
    )} />
  );
}

/**
 * The second step: the six digits of the code, its label saying where it went, which go on by themselves once all are in,
 * typed or filled from the message (S-01); or a new code by SMS once a minute has passed.
 * The number step's lockup stays where it was, so only the form under it changes (C-01).
 */
export function CodeStep({ phone, onBack, onSignedIn }: { phone: IndianMobile; onBack: () => void; onSignedIn: () => void }) {
  const { verifyCode } = useSignIn();
  const [isResent, setIsResent] = useState(false);
  const form = useForm<z.input<typeof codeForm>>({ resolver: zodResolver(codeForm), defaultValues: { code: '' } });
  // A code refused leaves the cells empty for the next, its reason kept beneath them.
  const fail = (failure: SignInFailure) => {
    form.setError('code', { type: 'server', message: t(FAILURE_COPY[failure]) });
    form.resetField('code', { keepError: true });
  };

  const verify = form.handleSubmit(async ({ code }) => {
    const signedIn = await verifyCode.mutateAsync({ phone, code });
    if (signedIn.ok) onSignedIn();
    else fail(signedIn.error);
  });
  // One check at a time: the sixth digit, Enter and Verify each ask, and a second would come back as an expired code.
  const check = () => {
    if (!verifyCode.isPending && !form.formState.isSubmitting) void verify();
  };

  const { errors } = form.formState;
  // A refusal from Auth carries its own words; anything else failed the six-digit check.
  const error = errors.code ? (errors.code.type === 'server' ? errors.code.message : t('common.signIn.codeInvalid')) : undefined;
  const hasSixDigits = signInCodeSchema.safeParse(useWatch({ control: form.control, name: 'code' })).success;
  return (
    <StepScreen
      title={t('common.signIn.codeTitle')}
      // Not while the code is being checked: going back mid-check would lose its outcome (#227).
      back={verifyCode.isPending ? undefined : { label: t('common.signIn.changeNumber'), onBack }}
      align="center"
      onSubmit={check}
      footer={
        <>
          <CodeField control={form.control} error={error} onComplete={check}
            label={t(isResent ? 'common.signIn.codeLabelBySms' : 'common.signIn.codeLabel', { phone: formatMobile(phone) })} />
          <Button variant="primary" size="large" type="submit" fullWidth isDisabled={!hasSixDigits} isLoading={verifyCode.isPending}>
            {t('common.signIn.submit')}
          </Button>
          <ResendButton phone={phone} onSent={() => setIsResent(true)} onFail={fail} />
        </>
      }
    >
      <Wordmark size="lg" withTagline withMotto align="center" />
    </StepScreen>
  );
}
