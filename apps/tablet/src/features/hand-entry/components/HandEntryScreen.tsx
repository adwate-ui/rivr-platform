import { useMyDevice } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Hand entry: the seat ring, the pot keypad and Log hand. Lane B builds it out (#42). */
export function HandEntryScreen() {
  const device = useMyDevice();
  const isFixed = device.data?.tableId != null;
  return <Screen title={t('tablet.handEntry.title')} status="empty" emptyText={t(isFixed ? 'tablet.handEntry.ready' : 'tablet.handEntry.empty')} />;
}
