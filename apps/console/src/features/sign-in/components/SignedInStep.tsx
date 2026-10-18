import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, StepScreen, Text } from '@rivr/ui';

interface SignedInStepProps {
  /** Who is signed in, once their staff record has loaded. */
  name: string | undefined;
  /** The session is still being read: never the empty form over a live session. */
  checking: boolean;
  /** Into the console, offered only once it is known whose console it is. */
  onContinue: (() => void) | undefined;
}

/**
 * Sign-in opened over a live session, from a bookmark or a restored tab on a shared computer: who is
 * signed in, the way into their console, and signing out so someone else can sign in (#227).
 */
export function SignedInStep({ name, checking, onContinue }: SignedInStepProps) {
  const signOut = useSignOut();
  const who = checking ? t('common.signIn.signedInChecking') : name ? t('common.signIn.signedInAs', { name }) : t('common.signIn.signedInSomeone');
  return (
    <StepScreen
      title={t('common.signIn.signedInTitle')}
      footer={
        <>
          {onContinue && name ? (
            <Button variant="primary" size="large" fullWidth onClick={onContinue}>
              {t('common.signIn.continueAs', { name })}
            </Button>
          ) : null}
          <Button variant="secondary" fullWidth isLoading={signOut.isPending} onClick={() => signOut.mutate()}>
            {t('common.signIn.signOut')}
          </Button>
        </>
      }
    >
      <Text>{who}</Text>
    </StepScreen>
  );
}
