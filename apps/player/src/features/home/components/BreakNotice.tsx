import { useRestrictions } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Text } from '@rivr/ui';

/** During a break (#56), as in the prototype: until when tables are closed to the member. Nothing otherwise. */
export function BreakNotice() {
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  if (breakUntil === null) return null;
  return <Text>{t('player.tonight.breakActive', { until: formatDayTime(new Date(breakUntil)) })}</Text>;
}
