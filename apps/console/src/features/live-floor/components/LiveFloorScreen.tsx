import { useStaffVenue } from '@rivr/db';
import { Floor } from './Floor.tsx';

/**
 * The Live floor (console v3, phase 2; decisions 0446 to 0449): tiles room by room, the requests docked beside them, and
 * the player, seat, table and leave sheets. Its toasts, with Undo, are the frame's (ToastProvider).
 */
export function LiveFloorScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <Floor venueId={staff.venue.venueId} permissions={staff.venue.permissions} />;
}
