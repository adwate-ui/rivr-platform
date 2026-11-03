import { Box, Grid } from '@rivr/ui';
import { LeagueCsvImport } from './LeagueCsvImport.tsx';
import { PointsByHand } from './PointsByHand.tsx';

/**
 * Points by hand (console v3), for staff with points.give: one member's points, earned, locked or League, within the staff
 * member's daily limit (#815); beside it, League points for many members from a CSV (L-01). Side by side at a desk.
 */
export function PointsTab({ venueId }: { venueId: string }) {
  return (
    <Grid columns={2} gap={4} stackBelow="medium">
      <Box surface="raised" radius="md" padding={5}><PointsByHand venueId={venueId} /></Box>
      <Box surface="raised" radius="md" padding={5}><LeagueCsvImport venueId={venueId} /></Box>
    </Grid>
  );
}
