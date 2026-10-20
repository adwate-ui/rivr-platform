/** This browser at a venue, as this_computer gives it (#384); computers.ts names it ThisComputer. */
interface ThisComputerRow {
  readonly computer: { readonly deviceId: string; readonly kind: 'cage' | 'console'; readonly name: string } | null;
  readonly isEnforced: boolean;
  readonly isOnStaffNetwork: boolean;
}

/**
 * This computer, from this_computer's row. Its columns are null when the computer is not enrolled,
 * which the generated types do not say, so they are read by hand.
 */
export function toThisComputer(row: unknown): ThisComputerRow {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  const deviceId = field('device_id');
  const kind = field('kind');
  const name = field('name');
  const isEnrolled = typeof deviceId === 'string' && (kind === 'cage' || kind === 'console') && typeof name === 'string';
  return {
    computer: isEnrolled ? { deviceId, kind, name } : null,
    isEnforced: field('is_enforced') === true,
    isOnStaffNetwork: field('is_on_staff_network') === true,
  };
}
