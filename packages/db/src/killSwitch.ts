import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types.ts';
import type { KillableFeature } from './parse/controlState.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A kill-switch level (features "Kill switch"). */
export type ControlLevel = Database['public']['Enums']['control_level'];

/** An engaged control (#27): its level and target, why, who engaged it and when, and for a freeze who asked to release it. */
export interface EngagedControl {
  readonly controlId: string;
  readonly level: ControlLevel;
  readonly feature: KillableFeature | null;
  readonly memberName: string | null;
  readonly staffName: string | null;
  readonly reason: string;
  readonly engagedAt: string;
  readonly engagedBy: string | null;
  /** For a venue freeze: the super admin who asked to release it, and why; a second one releases it. */
  readonly releaseAsk: { readonly by: string; readonly reason: string } | null;
}

/** A control to engage: the level, why, and for some levels its target, by mobile number (+91, from engageControlSchema) for a member or staff member. */
export interface EngageOrder {
  readonly level: ControlLevel;
  readonly reason: string;
  readonly feature: KillableFeature | null;
  readonly memberPhone: string | null;
  readonly staffPhone: string | null;
}

/**
 * Why a control did not change: not a super admin, a bad reason or target (or yourself), no member or
 * staff member with that number, the freeze's second super admin needed, fewer than two super admins
 * left able to release a freeze, or anything else.
 */
export type ControlFailure = 'not_allowed' | 'invalid' | 'no_member' | 'no_staff' | 'needs_second' | 'last_engagers' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ControlFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVTWO: 'needs_second', RVLCK: 'last_engagers',
};

/** The venue's engaged controls, newest first, for super admins (control.engage). */
export function useEngagedControls(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.engagedControls(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<EngagedControl[]> => {
      const { data, error } = await client.rpc('engaged_controls', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        controlId: row.control_id, level: row.level, feature: row.feature, memberName: row.member_name, staffName: row.staff_name,
        reason: row.reason, engagedAt: row.engaged_at, engagedBy: row.engaged_by,
        releaseAsk: row.release_asked_by === null || row.release_reason === null ? null : { by: row.release_asked_by, reason: row.release_reason },
      }));
    },
  });
}

/**
 * `engage` a control (a member or staff member found by mobile number), and `release` one with a
 * reason; a venue freeze's release gives 'awaiting_second' until a second super admin releases it.
 * Each a Result; each reloads the controls and the banner.
 */
export function useControlActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
  // The member or active staff member with that number: null when none is asked for, 'none' when nobody has it, 'failed' when the read failed.
  const targetOf = async (table: 'member' | 'staff', phone: string | null): Promise<string | null> => {
    if (phone === null) return null;
    const { data, error } = table === 'staff'
      ? await client.from('staff').select('id').eq('venue_id', venueId).eq('phone', phone).eq('is_active', true).limit(1)
      : await client.from('member').select('id').eq('venue_id', venueId).eq('phone', phone).limit(1);
    if (error) return 'failed';
    return data[0]?.id ?? 'none';
  };
  const engage = useMutation({
    mutationFn: async (order: EngageOrder): Promise<Result<string, ControlFailure>> => {
      const [memberId, staffId] = [await targetOf('member', order.memberPhone), await targetOf('staff', order.staffPhone)];
      if (memberId === 'failed' || staffId === 'failed') return err('unavailable');
      if (memberId === 'none') return err('no_member');
      if (staffId === 'none') return err('no_staff');
      const { data, error } = await client.rpc('engage_control', {
        p_venue_id: venueId, p_level: order.level, p_reason: order.reason, ...(order.feature === null ? {} : { p_feature: order.feature }),
        ...(memberId === null ? {} : { p_member_id: memberId }), ...(staffId === null ? {} : { p_staff_id: staffId }),
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  const release = useMutation({
    mutationFn: async ({ controlId, reason }: { controlId: string; reason: string }): Promise<Result<'released' | 'awaiting_second', ControlFailure>> => {
      const { data, error } = await client.rpc('release_control', { p_control_id: controlId, p_reason: reason });
      await reload();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data === 'awaiting_second' ? 'awaiting_second' : 'released');
    },
  });
  return { engage, release };
}
