import { useStaffVenue } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { Floor } from './Floor.tsx';

/**
 * The Live floor (console v3, phase 2; decisions 0446 to 0449): tiles room by room, the requests docked beside them, and
 * the player, seat, table and leave sheets. Its toasts carry Undo; the frame has no toast of its own yet.
 */
export function LiveFloorScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return (
    <ToastProvider place="console">
      <Floor venueId={staff.venue.venueId} permissions={staff.venue.permissions} />
    </ToastProvider>
  );
}
