import { siteBlockSchema, type SiteBlock } from '@rivr/contracts/site';
import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/houseRules), off the player's first load.
const keys = {
  houseRules: (userId: string) => ['user', userId, 'house-rules'] as const,
};

/**
 * The club's house rules (#637), as the website publishes them and the club edits them there: the house-rules page's intro
 * and rules. The game's legal standing stays on the website's About page alone (the owner, 12 Nov). Null for a part not
 * published.
 */
export interface HouseRules {
  readonly intro: string | null;
  readonly rules: readonly string[];
}

type Block<K extends SiteBlock['kind']> = Extract<SiteBlock, { kind: K }>;
interface BlockRow {
  readonly kind: string | null;
  readonly content: unknown;
}

/** The page's blocks, in order, each as the website would show it; one that does not read is left out. */
function blocksOf(rows: readonly BlockRow[]): SiteBlock[] {
  return rows.flatMap((row) => {
    const parsed = siteBlockSchema.safeParse({ kind: row.kind, content: row.content });
    return parsed.success ? [parsed.data] : [];
  });
}

const isHero = (block: SiteBlock): block is Block<'hero'> => block.kind === 'hero';
const isRules = (block: SiteBlock): block is Block<'rules'> => block.kind === 'rules';

/** The house rules for the player's Settings (#637); whatever the member's tier, as house rules are core. */
export function useHouseRules() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.houseRules(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<HouseRules> => {
      const { data, error } = await client.from('public_site_block').select('kind, content').eq('page_slug', 'house-rules').order('position');
      if (error) throw error;
      const page = blocksOf(data);
      return { intro: page.find(isHero)?.content.text ?? null, rules: page.find(isRules)?.content.rules ?? [] };
    },
  });
}
