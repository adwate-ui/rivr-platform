import { ROLE_PERMISSIONS, type Permission, type StaffRole } from '@rivr/contracts/roles';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A venue where the signed-in person is active staff, and what their role allows there. */
export interface StaffVenue {
  readonly staffId: string;
  readonly venueId: string;
  readonly venueName: string;
  /** The practice venue, where staff train; nothing in it is real. */
  readonly isPractice: boolean;
  readonly fullName: string;
  readonly role: StaffRole;
  /** From the role (`role_permission`, mirrored by ROLE_PERMISSIONS in @rivr/contracts). */
  readonly permissions: readonly Permission[];
}

/**
 * The venues where the signed-in person is active staff: the club first, then the practice venue.
 * Asked again every minute, so someone deactivated loses the console without a reload.
 */
export function useStaffVenues() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.staffVenues(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: 60_000,
    queryFn: async (): Promise<StaffVenue[]> => {
      const { data, error } = await client
        .from('staff')
        .select('id, venue_id, full_name, role, venue (name, is_practice)')
        .eq('user_id', userId ?? '')
        .eq('is_active', true);
      if (error) throw error;
      const venues = data.map((row) => ({
        staffId: row.id, venueId: row.venue_id, venueName: row.venue.name, isPractice: row.venue.is_practice,
        fullName: row.full_name, role: row.role, permissions: ROLE_PERMISSIONS[row.role],
      }));
      return venues.sort((a, b) => Number(a.isPractice) - Number(b.isPractice));
    },
  });
}

interface PracticeChoice {
  readonly practiceFor: string | null;
  readonly setPracticeFor: (userId: string | null) => void;
}

const PracticeContext = createContext<PracticeChoice | null>(null);

/** Holds whether the console works in the practice venue. Wrap the console in it, inside RivrDataProvider. */
export function StaffVenueProvider({ children }: { children: ReactNode }) {
  const { userId } = useRivrData();
  // The user who switched to practice: someone else signing in on this device starts at the club.
  const [practiceFor, setPracticeFor] = useState<string | null>(null);
  // Signing out ends practice too, so even the same person signs back in at the club.
  if (userId === null && practiceFor !== null) setPracticeFor(null);
  return <PracticeContext.Provider value={{ practiceFor, setPracticeFor }}>{children}</PracticeContext.Provider>;
}

/** The console's venue for the signed-in person, or why there is none yet. */
export type StaffVenueState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'not-staff' }
  | {
      readonly status: 'ready';
      readonly venue: StaffVenue;
      /** True when they are staff at the practice venue too, so they can switch to it. */
      readonly canPractise: boolean;
      readonly setPractice: (practice: boolean) => void;
    };

/** The venue the console works in: the club, or the practice venue while the staff member trains. */
export function useStaffVenue(): StaffVenueState {
  const { userId } = useRivrData();
  const choice = useContext(PracticeContext);
  if (choice === null) throw new Error('useStaffVenue must be used inside StaffVenueProvider');
  const venues = useStaffVenues();
  // A failed refresh keeps what was known, so the screen and any half-filled form stay.
  if (venues.data === undefined) return venues.isError ? { status: 'error', retry: () => void venues.refetch() } : { status: 'loading' };
  const club = venues.data.find((venue) => !venue.isPractice);
  const practice = venues.data.find((venue) => venue.isPractice);
  const wantsPractice = userId !== null && choice.practiceFor === userId;
  const venue = (wantsPractice ? practice : club) ?? club ?? practice;
  if (!venue) return { status: 'not-staff' };
  return {
    status: 'ready',
    venue,
    canPractise: club !== undefined && practice !== undefined,
    setPractice: (on) => choice.setPracticeFor(on ? userId : null),
  };
}
