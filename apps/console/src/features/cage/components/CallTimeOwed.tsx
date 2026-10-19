import type { CageMember } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { ErrorMessage, Text } from '@rivr/ui';

/**
 * The call time a member still owes, for the cashier before a cash-out (#79; additions flow 13): the
 * cash-out is refused until an admin lets them leave early on the Live floor. Nothing when none is owed.
 */
export function CallTimeOwed({ member }: { member: CageMember }) {
  if (member.callTimeOwed === 0) return null;
  const time = formatDuration(member.callTimeOwed);
  return member.isLetGoEarly
    ? <Text tone="muted">{t('console.cage.callTimeLetGo', { time })}</Text>
    : <ErrorMessage>{t('console.cage.callTimeOwed', { time })}</ErrorMessage>;
}
