import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';

/** Live floor: the room plan, tables, rake and hands per hour. Lane B builds it out. */
export function LiveFloorScreen() {
  const t = useT();
  return <Screen title={t('console.liveFloor.title')} status="empty" emptyText={t('console.liveFloor.empty')} />;
}
