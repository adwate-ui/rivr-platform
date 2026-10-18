import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Home: tonight's floor. Lane C builds it out, composing lanes B and D's features. */
export function HomeScreen() {
  const t = useT();
  return <Screen title={t('player.tonight.title')} status="empty" emptyText={t('player.tonight.empty')} />;
}
