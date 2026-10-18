import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStatus, useMember, useSignOut, useSignUp, type SignUpFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, Input, StepScreen, Text } from '@rivr/ui';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// The name as on Aadhaar, in English letters, as the database requires.
const nameForm = z.object({ fullName: z.string().trim().min(2).max(100).regex(/^[A-Za-z][A-Za-z .'-]*$/) });

const FAILURE_COPY: Readonly<Record<SignUpFailure, MessageKey>> = {
  invalid_name: 'player.signUp.nameInvalid',
  staff: 'player.signUp.staff',
  stopped: 'player.signUp.stopped',
  unavailable: 'player.signUp.unavailable',
};

/**
 * Joining the club, after the code: a new number gives the name on their Aadhaar, which the identity
 * check later matches, and becomes a member with the codes of the link they arrived by.
 */
export function SignUpScreen() {
  const authStatus = useAuthStatus();
  const member = useMember();
  const signUp = useSignUp();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [resolver] = useState(() => zodResolver(nameForm));
  const form = useForm<z.input<typeof nameForm>, unknown, z.output<typeof nameForm>>({ resolver, defaultValues: { fullName: '' } });

  const join = form.handleSubmit(async ({ fullName }) => {
    const joined = await signUp.mutateAsync({ fullName });
    if (!joined.ok) return form.setError('fullName', { type: 'server', message: t(FAILURE_COPY[joined.error]) });
    await navigate({ to: '/', replace: true });
  });
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" replace />;
  if (member.data) return <Navigate to="/" replace />;
  const { errors } = form.formState;
  const nameError = errors.fullName ? (errors.fullName.type === 'server' ? errors.fullName.message : t('player.signUp.nameInvalid')) : undefined;
  const nameField = form.register('fullName');
  return (
    <StepScreen
      title={t('player.signUp.title')}
      onSubmit={join}
      footer={
        <>
          <Button variant="primary" type="submit" fullWidth isLoading={signUp.isPending || member.isPending}>
            {t('player.signUp.submit')}
          </Button>
          {/* A mistyped number signs out and starts again: this screen sends a signed-out phone to sign-in. */}
          <Button variant="text" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
            {t('player.signUp.otherNumber')}
          </Button>
        </>
      }
    >
      <Text tone="muted">{t('player.signUp.intro')}</Text>
      <Input {...nameField} label={t('player.signUp.nameLabel')} autoComplete="name" maxLength={100} autoFocus error={nameError} />
    </StepScreen>
  );
}
