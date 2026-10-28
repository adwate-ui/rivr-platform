import { WINNER_CARD_KINDS } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/winnerCards).
const keys = {
  mine: (userId: string) => ['user', userId, 'winner-cards'] as const,
  toPost: (userId: string, venueId: string) => ['user', userId, 'winner-cards-to-post', venueId] as const,
};

const BUCKET = 'winner-cards';
// A drawn card's link lasts an hour for its player; staff download at once, so a card its player stops sharing is out of
// reach within five minutes.
const LINK_SECONDS = 60 * 60;
const DOWNLOAD_SECONDS = 5 * 60;

/** What a winner card celebrates (#155). */
export type WinnerCardKind = (typeof WINNER_CARD_KINDS)[number];

/** A winner card as its player or staff see it. */
export interface WinnerCard {
  readonly cardId: string;
  readonly kind: WinnerCardKind;
  /** A tournament's name; null for a high hand or a jackpot. */
  readonly eventName: string | null;
  readonly prizePaise: bigint;
  readonly wonAt: string;
  /** A link to the drawn card, or null until the nightly job draws it. */
  readonly imageUrl: string | null;
}

/** The signed-in member's card, and whether they share it. */
export interface MyWinnerCard extends WinnerCard {
  readonly isShared: boolean;
}

/** A card its player shares, for staff who publish marketing. */
export interface SharedWinnerCard extends WinnerCard {
  /** First name and initial: `Kavya R.` */
  readonly playerName: string;
  readonly sharedAt: string;
}

const kindOf = (kind: string): WinnerCardKind => WINNER_CARD_KINDS.find((known) => known === kind) ?? 'tournament';

function eventNameOf(details: Json): string | null {
  const name = typeof details === 'object' && details !== null && !Array.isArray(details) ? details.event_name : undefined;
  return typeof name === 'string' ? name : null;
}

/** Links to the drawn cards among these paths, by path; downloads for staff. */
async function linksFor(client: RivrClient, paths: readonly (string | null)[], download: boolean): Promise<Map<string, string>> {
  const drawn = paths.filter((path): path is string => path !== null);
  if (drawn.length === 0) return new Map();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(drawn, download ? DOWNLOAD_SECONDS : LINK_SECONDS, { download });
  if (error) throw error;
  return new Map(data.flatMap((link): [string, string][] => (link.path === null || link.signedUrl === null ? [] : [[link.path, link.signedUrl]])));
}

const linkOf = (links: Map<string, string>, path: string | null): string | null => (path === null ? null : links.get(path) ?? null);

/** The signed-in member's winner cards, newest win first (#155). */
export function useMyWinnerCards() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.mine(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyWinnerCard[]> => {
      const { data, error } = await client.rpc('my_winner_cards');
      if (error) throw error;
      const links = await linksFor(client, data.map((row) => row.image_path), false);
      return data.map((row) => ({
        cardId: row.card_id, kind: kindOf(row.kind), eventName: eventNameOf(row.details), prizePaise: BigInt(row.prize_paise), wonAt: row.won_at,
        imageUrl: linkOf(links, row.image_path), isShared: row.is_shared,
      }));
    },
  });
}

/** Shares a card of the member's on the club's social, or stops sharing it; a Result, and the cards reload. */
export function useShareWinnerCard() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, isShared }: { cardId: string; isShared: boolean }): Promise<Result<null, 'unavailable'>> => {
      const { error } = await client.rpc('share_winner_card', { p_card_id: cardId, p_is_shared: isShared });
      await queryClient.invalidateQueries({ queryKey: keys.mine(userId ?? 'signed-out') });
      return error ? err('unavailable') : ok(null);
    },
  });
}

/** The drawn cards their players share at the venue, newest share first, for staff who publish marketing (#155). */
export function useWinnerCardsToPost(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.toPost(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<SharedWinnerCard[]> => {
      const { data, error } = await client.rpc('winner_cards_to_post', { p_venue_id: venueId });
      if (error) throw error;
      const links = await linksFor(client, data.map((row) => row.image_path), true);
      return data.map((row) => ({
        cardId: row.card_id, kind: kindOf(row.kind), eventName: eventNameOf(row.details), prizePaise: BigInt(row.prize_paise), wonAt: row.won_at,
        imageUrl: linkOf(links, row.image_path), playerName: row.player_name, sharedAt: row.shared_at,
      }));
    },
  });
}
