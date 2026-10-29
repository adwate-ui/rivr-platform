import { siteBlockSchema, type SiteBlock } from '@rivr/contracts/site';
import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/houseRules), off the player's first load.
const keys = {
  houseRules: (userId: string) => ['user', userId, 'house-rules'] as const,
};

/** One case behind poker's legal standing: `1996`, "K.R. Lakshmanan v. State of Tamil Nadu", and what it holds. */
export interface LegalCase {
  readonly when: string;
  readonly title: string;
  readonly text: string | null;
}

/**
 * The club's house rules and the game's legal standing (#637), as the website publishes them and the club edits them
 * there: the house-rules page's intro and rules, and the about page's legal timeline. Null for a part not published.
 */
export interface HouseRules {
  readonly intro: string | null;
  readonly rules: readonly string[];
  readonly legal: { readonly heading: string | null; readonly intro: string | null; readonly cases: readonly LegalCase[] } | null;
}

type Block<K extends SiteBlock['kind']> = Extract<SiteBlock, { kind: K }>;
interface BlockRow {
  readonly page_slug: string | null;
  readonly kind: string | null;
  readonly content: unknown;
}

/** A page's blocks, in order, each as the website would show it; one that does not read is left out. */
function blocksOf(rows: readonly BlockRow[], page: string): SiteBlock[] {
  return rows.filter((row) => row.page_slug === page).flatMap((row) => {
    const parsed = siteBlockSchema.safeParse({ kind: row.kind, content: row.content });
    return parsed.success ? [parsed.data] : [];
  });
}

const isHero = (block: SiteBlock): block is Block<'hero'> => block.kind === 'hero';
const isRules = (block: SiteBlock): block is Block<'rules'> => block.kind === 'rules';
const isTimeline = (block: SiteBlock): block is Block<'timeline'> => block.kind === 'timeline';

/** The house rules and legal standing for the player's Settings (#637); whatever the member's tier, as house rules are core. */
export function useHouseRules() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.houseRules(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<HouseRules> => {
      const { data, error } = await client.from('public_site_block').select('page_slug, kind, content')
        .in('page_slug', ['house-rules', 'about']).order('position');
      if (error) throw error;
      const page = blocksOf(data, 'house-rules');
      const legal = blocksOf(data, 'about').find(isTimeline);
      return {
        intro: page.find(isHero)?.content.text ?? null,
        rules: page.find(isRules)?.content.rules ?? [],
        legal: legal === undefined ? null : {
          heading: legal.content.heading ?? null, intro: legal.content.intro ?? null,
          cases: legal.content.items.map((item) => ({ when: item.when, title: item.title, text: item.text ?? null })),
        },
      };
    },
  });
}
