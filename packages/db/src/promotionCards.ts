import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A live promotion's card (#86), as published: its title, what it gives and who and when. */
export interface PromotionCardData {
  readonly id: string;
  readonly title: string;
  readonly detail: string | null;
  readonly runs: string | null;
}

export interface CardRow {
  promotion_id: string;
  title: string;
  detail: string | null;
  runs: string | null;
}

/** A card as the database gives it. */
export const toPromotionCard = (row: CardRow): PromotionCardData => ({ id: row.promotion_id, title: row.title, detail: row.detail, runs: row.runs });

// Cards change when the floor publishes or pauses one: Home reads them again every minute.
const HOME_CHECK = 60_000;

/** The member's venue's live promotion cards for Home's pager, highest priority first; none without feature promotions.feed. */
export function useMyPromotionCards() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myPromotionCards(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: HOME_CHECK,
    queryFn: async (): Promise<PromotionCardData[]> => {
      const { data, error } = await client.rpc('my_promotion_cards');
      if (error) throw error;
      return data.map(toPromotionCard);
    },
  });
}

