import { t } from '@rivr/i18n';
import { StepScreen, Text } from '@rivr/ui';
import { SignOutButton } from './SignOutButton.tsx';

/** Someone signed in who is not active staff at any venue: they can only sign out. */
export function NotStaff() {
  return (
    <StepScreen title={t('console.notStaff.title')} footer={<SignOutButton variant="primary" fullWidth />}>
      <Text>{t('console.notStaff.body')}</Text>
    </StepScreen>
  );
}
