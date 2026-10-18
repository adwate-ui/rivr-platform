// From the result module alone: the package index builds every Zod schema, which the player app's
// first screen does not need (#11).
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The games a member can ask waitlist alerts for. */
export const GAMES = ['nlh', 'plo', 'tournaments'] as const;
export type Game = (typeof GAMES)[number];

/** The push notifications a member chooses in Profile. Promotions follow the marketing consent. */
export const PUSH_CHOICES = ['push.seat_ready', 'push.call_time_complete', 'push.withdrawal_sent', 'push.tournament_starting'] as const;
export type PushChoice = (typeof PUSH_CHOICES)[number];

/** A stake as blinds in paise: 100/200 is 10000n and 20000n. */
export interface Stake {
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
}

/** What Profile shows of the member's own choices. */
export interface Preferences {
  readonly games: readonly Game[];
  /** The stake for waitlist alerts, or null for any. */
  readonly stake: Stake | null;
  /** The notifications the member turned off; every other one is on. */
  readonly notificationsOff: readonly PushChoice[];
  /** Marketing consent in force: promotions by WhatsApp and push. */
  readonly marketing: boolean;
}

function stakeOf(row: { small_blind: number | null; big_blind: number | null } | null): Stake | null {
  if (row?.small_blind == null || row.big_blind == null) return null;
  return { smallBlind: BigInt(row.small_blind), bigBlind: BigInt(row.big_blind) };
}

/** The signed-in member's games, stake, notification choices and marketing consent. */
export function usePreferences() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.preferences(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Preferences> => {
      const [saved, choices, consent] = await Promise.all([
        client.from('member_preference').select('games, small_blind, big_blind').maybeSingle(),
        client.from('notification_preference').select('push_type, is_on'),
        // Their own consent only: a login that is also staff can read every member's consent rows.
        client.rpc('has_my_consent', { p_purpose: 'marketing' }),
      ]);
      const error = saved.error ?? choices.error ?? consent.error;
      if (error) throw error;
      const off = (choices.data ?? []).filter((choice) => !choice.is_on).map((choice) => choice.push_type);
      return {
        games: GAMES.filter((game) => saved.data?.games.includes(game)),
        stake: stakeOf(saved.data),
        notificationsOff: PUSH_CHOICES.filter((type) => off.includes(type)),
        marketing: consent.data === true,
      };
    },
  });
}

/**
 * Changes to the member's own choices: `saveGames` (with the stake kept as it is),
 * `setNotification` and `setMarketing` (the marketing consent, given or withdrawn). Each resolves
 * to a Result and reloads the choices, so a change that failed shows its old state again.
 */
export function usePreferenceActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();

  async function settle({ error }: { error: unknown }): Promise<Result<null, 'unavailable'>> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.preferences(userId ?? 'signed-out') });
    return error ? err('unavailable') : ok(null);
  }

  const saveGames = useMutation({
    mutationFn: async ({ games, stake }: { games: readonly Game[]; stake: Stake | null }) => {
      const blinds = stake ? { p_small_blind: Number(stake.smallBlind), p_big_blind: Number(stake.bigBlind) } : {};
      return settle(await client.rpc('save_my_preferences', { p_games: [...games], ...blinds }));
    },
  });
  const setNotification = useMutation({
    mutationFn: async ({ type, isOn }: { type: PushChoice; isOn: boolean }) =>
      settle(await client.rpc('set_my_notification', { p_push_type: type, p_is_on: isOn })),
  });
  const setMarketing = useMutation({
    mutationFn: async (isOn: boolean) =>
      settle(await (isOn ? client.rpc('give_consent', { p_purpose: 'marketing' }) : client.rpc('withdraw_consent', { p_purpose: 'marketing' }))),
  });
  return { saveGames, setNotification, setMarketing };
}
