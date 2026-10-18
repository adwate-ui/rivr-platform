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

  const { errors } = form.formState;
  // A refusal from Auth carries its own words; anything else failed the six-digit check.
  const error = errors.code ? (errors.code.type === 'server' ? errors.code.message : t('common.signIn.codeInvalid')) : undefined;
  const codeField = form.register('code');
  const hasSixDigits = signInCodeSchema.safeParse(useWatch({ control: form.control, name: 'code' })).success;
  return (
    <StepScreen
      title={t('common.signIn.codeTitle')}
      back={{ label: t('common.signIn.changeNumber'), onBack }}
      onSubmit={verify}
      footer={
        <>
          <Button variant="primary" type="submit" fullWidth isDisabled={!hasSixDigits} isLoading={verifyCode.isPending}>
            {t('common.signIn.submit')}
          </Button>
          <ResendButton phone={phone} onFail={fail} />
        </>
      }
    >
      <Input {...codeField} label={t('common.signIn.codeLabel', { phone: formatMobile(phone) })} variant="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t('common.signIn.codePlaceholder')} autoFocus error={error} />
    </StepScreen>
  );
}
