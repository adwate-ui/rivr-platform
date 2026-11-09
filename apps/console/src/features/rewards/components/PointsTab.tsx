import { Box, Grid } from '@rivr/ui';
import { LeagueCsvImport } from './LeagueCsvImport.tsx';
import { PointsByHand } from './PointsByHand.tsx';

/**
 * Points by hand (console v3), for staff with points.give: one member's points, earned, locked or League, within the staff
 * member's daily limit (#815), and for those with bonus.give their bonus chips too (the owner, 9 Nov); beside it, League points for
 * many members from a CSV (L-01). The console's cards.
 */
export function PointsTab({ venueId, canGiveBonus }: { venueId: string; canGiveBonus: boolean }) {
  return (
    <Grid columns="cards" gap={4}>
      <Box surface="raised" radius="md" padding={5}><PointsByHand venueId={venueId} canGiveBonus={canGiveBonus} /></Box>
      <Box surface="raised" radius="md" padding={5}><LeagueCsvImport venueId={venueId} /></Box>
    </Grid>
  );
}
