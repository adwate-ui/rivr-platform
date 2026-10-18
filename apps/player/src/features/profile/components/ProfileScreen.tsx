import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Profile, behind the member's initial. Lane C adds sign-in. */
export function ProfileScreen() {
  const t = useT();
  return <Screen title={t('player.profile.title')} status="empty" emptyText={t('player.profile.empty')} />;
}
