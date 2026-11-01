import { useRestrictions } from '@rivr/db';
import { formatDateTime, t } from '@rivr/i18n';
import { Box, Text } from '@rivr/ui';

/** During a break (#56), as in the prototype: until when tables are closed to the member. Nothing otherwise. */
export function BreakNotice() {
  const breakUntil = useRestrictions().data?.breakUntil ?? null;
  if (breakUntil === null) return null;
  return (
    <Box surface="raised" padding={4} radius="md">
      <Text>{t('player.tonight.breakActive', { until: formatDateTime(new Date(breakUntil)) })}</Text>
    </Box>
  );
}
