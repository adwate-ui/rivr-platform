import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { useStaffVenues } from './staff.tsx';

/** How tall the console's rows are (decision 0442): comfortable, 42 px, or compact, 34 px. */
export type Density = 'comfortable' | 'compact';

export const DENSITIES: readonly Density[] = ['comfortable', 'compact'];

const densityOf = (value: string | undefined): Density => (value === 'compact' ? 'compact' : 'comfortable');

/** The signed-in staff member's own density at the venue the console works in; comfortable until they choose. */
export function useStaffDensity(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.staffDensity(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Density> => {
      const { data, error } = await client.from('staff_preference').select('density').eq('venue_id', venueId).maybeSingle();
      if (error) throw error;
      return densityOf(data?.density);
    },
  });
}

/**
 * Keeps the staff member's density at every venue where they are staff, so the club and the practice venue match
 * (decision 0442). Shown at once, and put back if the database refuses it.
 */
export function useSetStaffDensity() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const venues = useStaffVenues();
  const keyFor = (venueId: string) => queryKeys.staffDensity(userId ?? 'signed-out', venueId);
  return useMutation({
    mutationFn: async (density: Density): Promise<Result<Density, 'unavailable'>> => {
      const rows = (venues.data ?? []).map((venue) => ({ staff_id: venue.staffId, venue_id: venue.venueId, density }));
      // A read still on its way would put the old choice back over the new one.
      await Promise.all(rows.map((row) => queryClient.cancelQueries({ queryKey: keyFor(row.venue_id) })));
      for (const row of rows) queryClient.setQueryData(keyFor(row.venue_id), density);
      const { error } = await client.from('staff_preference').upsert(rows, { onConflict: 'staff_id' });
      if (error) {
        await Promise.all(rows.map((row) => queryClient.invalidateQueries({ queryKey: keyFor(row.venue_id) })));
        return err('unavailable');
      }
      return ok(density);
    },
  });
}
