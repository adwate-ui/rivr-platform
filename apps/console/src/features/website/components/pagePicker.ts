import type { EditorPage } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import type { PickListGroup } from '@rivr/ui';

/** The groups of the website's pages, in the picker's order. */
const GROUPS = ['club', 'guides', 'legal'] as const;
type PageGroup = (typeof GROUPS)[number];

const LEGAL: ReadonlySet<string> = new Set(['privacy', 'terms', 'responsible-play']);

/** A page's group, from its address: the legal pages, the journal's guides and the questions, and the club's own pages. */
function groupOf(slug: string): PageGroup {
  if (LEGAL.has(slug)) return 'legal';
  return slug === 'journal' || slug.startsWith('journal-') || slug === 'questions' ? 'guides' : 'club';
}

/**
 * A page's name in the picker: its title, besides the two pages whose title is the club's own name, the home page and the
 * link-in-bio page, which the picker names by what they are (the duplicate the 3 Nov screenshots found).
 */
export function pageLabel(page: EditorPage): string {
  if (page.slug === 'home') return t('console.website.pages.home');
  if (page.slug === 'links') return t('console.website.pages.links');
  return page.title;
}

const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });

/** The pages whose name or address holds `query`, case aside, in their groups, each by name; a group with none is left out. */
export function pageGroups(pages: readonly EditorPage[], query: string): PickListGroup[] {
  const typed = query.trim().toLowerCase();
  const shown = pages
    .map((page) => ({ page, label: pageLabel(page) }))
    .filter(({ page, label }) => typed === '' || label.toLowerCase().includes(typed) || page.slug.includes(typed))
    .sort((a, b) => COLLATOR.compare(a.label, b.label));
  return GROUPS.map((group) => ({
    label: t(`console.website.groups.${group}`),
    items: shown.filter(({ page }) => groupOf(page.slug) === group).map(({ page, label }) => ({ id: page.pageId, title: label })),
  })).filter((group) => group.items.length > 0);
}
