import { ownerSnapshotSchema } from '@rivr/contracts/ownerDashboard';
import type { Paise } from '@rivr/domain/money';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/ownerDashboard), off the player's first load.
const keys = {
  ownerSnapshot: (userId: string, venueId: string) => ['user', userId, 'owner-snapshot', venueId] as const,
};

// A burst of signals (a busy minute of hands) reads once, a second after the first.
const SIGNAL_SETTLE = 1_000;

/** What the owner dashboard shows (#101): tonight, the room, the cash position, alerts and the last fortnight's nights. */
export interface OwnerSnapshot {
  readonly rakeTonight: Paise;
  readonly handsTonight: number;
  readonly tablesOpen: number;
  readonly seated: number;
  readonly inTheRoom: number;
  readonly cash: readonly { readonly name: string; readonly balance: Paise }[];
  readonly playersMoney: Paise;
  readonly chipsOut: Paise;
  /** The latest alerts, newest first: their kinds only, never their details. */
  readonly alerts: readonly { readonly id: string; readonly kind: string; readonly raisedAt: string }[];
  /** The rake of each of the last fourteen club nights, oldest first: `2026-10-26`. */
  readonly nights: readonly { readonly day: string; readonly rake: Paise }[];
}

/** The owner dashboard's figures, read again whenever the venue's owner topic signals a change. */
export function useOwnerSnapshot(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.ownerSnapshot(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<OwnerSnapshot> => {
      const { data, error } = await client.rpc('owner_snapshot', { p_venue_id: venueId });
      if (error) throw error;
      const json = ownerSnapshotSchema.parse(data);
      return {
        rakeTonight: toPaise(json.rake_tonight_paise), handsTonight: json.hands_tonight, tablesOpen: json.tables_open, seated: json.seated,
        inTheRoom: json.in_the_room, cash: json.cash.map((account) => ({ name: account.name, balance: toPaise(account.balance_paise) })),
        playersMoney: toPaise(json.players_money_paise), chipsOut: toPaise(json.chips_out_paise),
        alerts: json.alerts.map((alert) => ({ id: alert.id, kind: alert.kind, raisedAt: alert.raised_at })),
        nights: json.nights.map((night) => ({ day: night.day, rake: toPaise(night.rake_paise) })),
      };
    },
  });
}

/**
 * Live (#101): reads the dashboard again when the database broadcasts on the venue's private topic
 * (owner:<venue id>) that something it shows changed, once a second after the first signal of a burst.
 */
export function useOwnerSignals(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const channel = client.channel(`owner:${venueId}`, { config: { private: true } });
    channel.on('broadcast', { event: 'changed' }, () => {
      if (pending !== null) return;
      pending = setTimeout(() => {
        pending = null;
        void queryClient.invalidateQueries({ queryKey: keys.ownerSnapshot(userId, venueId) });
      }, SIGNAL_SETTLE);
    });
    channel.subscribe();
    return () => {
      if (pending !== null) clearTimeout(pending);
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId, venueId]);
}
