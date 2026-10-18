import { zodResolver } from '@hookform/resolvers/zod';
import { signInCodeSchema, type IndianMobile } from '@rivr/contracts';
import { useSignIn, type SignInFailure } from '@rivr/db';
import { formatMobile, t } from '@rivr/i18n';
import { Button, Input, StepScreen } from '@rivr/ui';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FAILURE_COPY } from './failureCopy.ts';
import { ResendButton } from './ResendButton.tsx';

const codeForm = z.object({ code: signInCodeSchema });

/** The second step: the six-digit code sent to the number, or a new one once a minute has passed. */
export function CodeStep({ phone, onBack, onSignedIn }: { phone: IndianMobile; onBack: () => void; onSignedIn: () => void }) {
  const { verifyCode } = useSignIn();
  const form = useForm<z.input<typeof codeForm>>({ resolver: zodResolver(codeForm) });
  const fail = (failure: SignInFailure) => form.setError('code', { type: 'server', message: t(FAILURE_COPY[failure]) });

  const verify = form.handleSubmit(async ({ code }) => {
    const signedIn = await verifyCode.mutateAsync({ phone, code });
    if (signedIn.ok) onSignedIn();
    else fail(signedIn.error);
  });

  // Verify stays off until six digits are in, so the only error is a refusal from Auth.
  const error = form.formState.errors.code?.message;
  const codeField = form.register('code');
  const hasSixDigits = signInCodeSchema.safeParse(useWatch({ control: form.control, name: 'code' })).success;
  return (
    <StepScreen
      title={t('player.signIn.codeTitle')}
      back={{ label: t('player.signIn.changeNumber'), onBack }}
      onSubmit={verify}
      footer={
        <>
          <Button variant="primary" type="submit" fullWidth isDisabled={!hasSixDigits} isLoading={verifyCode.isPending}>
            {t('player.signIn.submit')}
          </Button>
          <ResendButton phone={phone} onFail={fail} />
        </>
      }
    >
      <Input {...codeField} label={t('player.signIn.codeLabel', { phone: formatMobile(phone) })} variant="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t('player.signIn.codePlaceholder')} autoFocus error={error} />
    </StepScreen>
  );
}
