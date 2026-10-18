import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';

interface SignedInStepProps {
  /** Who is signed in, once their member record has loaded. */
  name: string | undefined;
  /** The session is still being read: never the empty form over a live session. */
  checking: boolean;
  /** Into the app; absent while the session is still being read. */
  onContinue: (() => void) | undefined;
  /** After signing out: the form for the next person, who starts afresh. */
  onSignedOut: () => void;
}

/**
 * Sign-in opened over a live session, from a bookmark or a restored tab on a shared phone: who is
 * signed in, the way into the app, and signing out so someone else can sign in (#227).
 */
export function SignedInStep({ name, checking, onContinue, onSignedOut }: SignedInStepProps) {
  const signOut = useSignOut();
  const who = checking ? t('common.signIn.signedInChecking') : name ? t('common.signIn.signedInAs', { name }) : t('common.signIn.signedInSomeone');
  return (
    <StepScreen
      title={t('common.signIn.signedInTitle')}
      footer={
        <>
          {onContinue ? (
            <Button variant="primary" size="large" fullWidth onClick={onContinue}>
              {name ? t('common.signIn.continueAs', { name }) : t('common.signIn.continue')}
            </Button>
          ) : null}
          {/* Awaited, not an onSuccess: signing out replaces this step before such a callback could run. */}
          <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => void signOut.mutateAsync().then(onSignedOut)}>
            {t('common.signIn.signOut')}
          </Button>
        </>
      }
    >
      <Text>{who}</Text>
    </StepScreen>
  );
}
