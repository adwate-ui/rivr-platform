import { useSignOut } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Stack, Text } from '@rivr/ui';

/**
 * The way out of an identity check that will not go on (P-03): the front desk checks it in person, or the member signs out.
 * Before the check no screen but this one opens, so nobody here has turned on notifications to take back on sign out.
 */
export function KycHelp() {
  const signOut = useSignOut();
  return (
    <Stack gap={2}>
      <Text variant="small" tone="muted">{t('player.kyc.inPerson')}</Text>
      <Inline>
        <Button variant="text" isLoading={signOut.isPending} onClick={() => signOut.mutate()}>{t('common.signIn.signOut')}</Button>
      </Inline>
    </Stack>
  );
}
