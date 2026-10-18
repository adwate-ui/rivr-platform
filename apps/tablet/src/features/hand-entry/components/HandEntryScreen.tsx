import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Hand entry: the seat ring, the pot keypad and Log hand. Lane B builds it out. */
export function HandEntryScreen() {
  const t = useT();
  return <Screen title={t('tablet.handEntry.title')} status="empty" emptyText={t('tablet.handEntry.empty')} />;
}
