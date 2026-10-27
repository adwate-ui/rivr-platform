import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One item on a hire's onboarding checklist (#107): an SOP whose version in force asks their role. */
export interface OnboardingItem {
  readonly sopId: string;
  readonly title: string;
  readonly versionId: string;
  readonly version: number;
  /** When the hire acknowledged this version; null while the item is open, and again once a new version comes into force. */
  readonly acknowledgedAt: string | null;
}

/**
 * One hire's onboarding checklist, for staff who manage staff: each SOP in force that asks their role,
 * ticked when they acknowledge it. Every row on the Staff screen shares one read of the venue's checklists.
 */
export function useOnboardingChecklist(venueId: string, staffId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.onboardingChecklists(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await client.rpc('onboarding_checklists', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        staffId: row.staff_id,
        item: { sopId: row.sop_id, title: row.title, versionId: row.version_id, version: row.version, acknowledgedAt: row.acknowledged_at },
      }));
    },
    select: (rows): OnboardingItem[] => rows.filter((row) => row.staffId === staffId).map((row) => row.item),
  });
}
