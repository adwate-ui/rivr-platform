import { t } from '@rivr/i18n';
import { Box, Button, DotStatus, Inline } from '@rivr/ui';
import { floorSeatHref, type Tonight } from './tonight.ts';

interface SeatLineProps {
  /** The member's name, for the link's accessible name. */
  name: string;
  seat: Extract<Tonight, { kind: 'seated' }>;
  onNavigate: (href: string) => void;
}

/** A seated member's seat on their record (console v3), "Table 2, seat 3", with Show, which opens it on the live floor. */
export function SeatLine({ name, seat, onNavigate }: SeatLineProps) {
  return (
    <Box surface="surface" paddingX={4} paddingY={2} radius="md">
      <Inline gap={3} align="center" justify="between">
        <DotStatus tone="active" label={t('console.members.seatFull', { table: seat.tableName, seat: seat.seat })} />
        <Button variant="text" size="small" aria-label={t('console.members.showOnFloor', { name })}
          onClick={() => onNavigate(floorSeatHref(seat.tableId, seat.seat))}>{t('console.members.show')}</Button>
      </Inline>
    </Box>
  );
}
