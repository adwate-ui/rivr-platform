import { zodResolver } from '@hookform/resolvers/zod';
import { signInCodeSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, CodeInput, Stack, StepScreen } from '@rivr/ui';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';
import { ResendButton } from './ResendButton.tsx';

const codeForm = z.object({ code: signInCodeSchema });

/** The six tall cells, checked as soon as the sixth digit is in, typed or filled from the message. */
function CodeField({ control, error, onComplete }: { control: Control<z.input<typeof codeForm>>; error: string | undefined; onComplete: () => void }) {
  return (
    <Controller control={control} name="code" render={({ field }) => (
      <CodeInput ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} autoFocus error={error} onComplete={onComplete}
        label={t('player.signIn.codeLabel')} size="tall" />
    )} />
  );
}

/**
 * The second step (decision 0320): Back, "Enter the code", where it went (by WhatsApp, decision 0297), six cells that go on
 * by themselves once full, Verify, and a new code once the minute is up. The phone's offer to fill the code from a message
 * still works (`autocomplete="one-time-code"`); WebOTP is not used, as it reads only SMS.
 */
export function CodeStep({ phone, onBack, onSignedIn }: { phone: IndianMobile; onBack: () => void; onSignedIn: () => void }) {
  const { verifyCode } = useSignIn();
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
      title={t('player.signIn.codeTitle')}
      look={{ subtitle: t('player.signIn.codeSent', { phone: formatMobile(phone) }) }}
      // Not while the code is being checked: going back mid-check would lose its outcome (#227).
      back={verifyCode.isPending ? undefined : { label: t('player.signIn.back'), onBack }}
      onSubmit={check}
      footer={null}
    >
      <Stack gap={6}>
        <CodeField control={form.control} error={error} onComplete={check} />
        <Button variant="primary" size="tall" type="submit" fullWidth isDisabled={!hasSixDigits} isLoading={verifyCode.isPending}>
          {t('player.signIn.verify')}
        </Button>
        <ResendButton phone={phone} onFail={fail} />
      </Stack>
    </StepScreen>
  );
}
