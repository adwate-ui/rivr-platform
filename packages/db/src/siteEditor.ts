import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/siteEditor).
const keys = {
  pages: (userId: string, venueId: string) => ['user', userId, 'site-pages', venueId] as const,
  page: (userId: string, pageId: string) => ['user', userId, 'site-page', pageId] as const,
};

/** A page of the website, for the editor (#129). */
export interface EditorPage {
  readonly pageId: string;
  readonly slug: string;
  readonly title: string;
}

/** A block as the editor holds it: its kind and content, as @rivr/contracts siteBlockSchema reads them. */
export interface EditorBlock {
  readonly kind: string;
  readonly content: Json;
}

/** A version of a page: a draft, scheduled for a time, published, or replaced by a later one. */
export interface SiteRevision {
  readonly revisionId: string;
  readonly status: 'draft' | 'scheduled' | 'published' | 'replaced';
  readonly blocks: readonly EditorBlock[];
  readonly publishAt: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly previewToken: string;
}

/** A page as the editor opens it: the blocks it shows now, and its versions, newest first. */
export interface EditorPageState {
  readonly blocks: readonly EditorBlock[];
  readonly revisions: readonly SiteRevision[];
}

/** Why an edit did not go through: the role, a page or version gone, a block the website cannot show, frozen, or else. */
export type SiteEditFailure = 'not_allowed' | 'gone' | 'invalid' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, SiteEditFailure>> = { '42501': 'not_allowed', P0002: 'gone', '22023': 'invalid', RVFRZ: 'paused' };
const STATUSES: readonly SiteRevision['status'][] = ['draft', 'scheduled', 'published', 'replaced'];

/** The blocks in a revision's jsonb, as the editor holds them. */
function blocksOf(value: Json): EditorBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block) => {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) return [];
    const { kind, content } = block;
    return typeof kind === 'string' && content !== undefined ? [{ kind, content }] : [];
  });
}

/** The venue's website pages, by address, for staff who edit the website. */
export function useSitePages(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.pages(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<EditorPage[]> => {
      const { data, error } = await client.from('site_page').select('id, slug, title').eq('venue_id', venueId).order('slug');
      if (error) throw error;
      return data.map((row) => ({ pageId: row.id, slug: row.slug, title: row.title }));
    },
  });
}

/** A page's blocks as it shows them now, and its versions, newest first. */
export function useEditorPage(pageId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.page(userId ?? 'signed-out', pageId),
    enabled: userId !== null,
    queryFn: async (): Promise<EditorPageState> => {
      const [blocks, revisions] = await Promise.all([
        client.from('site_block').select('kind, content').eq('page_id', pageId).order('position'),
        client.from('site_revision').select('id, status, blocks, publish_at, published_at, created_at, preview_token').eq('page_id', pageId)
          .order('created_at', { ascending: false }).limit(30),
      ]);
      if (blocks.error) throw blocks.error;
      if (revisions.error) throw revisions.error;
      return {
        blocks: blocks.data.map((row) => ({ kind: row.kind, content: row.content })),
        revisions: revisions.data.map((row) => ({
          revisionId: row.id, status: STATUSES.find((status) => status === row.status) ?? 'replaced', blocks: blocksOf(row.blocks), publishAt: row.publish_at,
          publishedAt: row.published_at, createdAt: row.created_at, previewToken: row.preview_token,
        })),
      };
    },
  });
}

/** Saving a page's draft (its preview token), publishing it now or at a time (now when `at` is null), and publishing an earlier version again. */
export function useSiteEditor(venueId: string, pageId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: keys.page(userId ?? 'signed-out', pageId) });
  const failureOf = (code: string): SiteEditFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
  const save = useMutation({
    mutationFn: async (blocks: readonly EditorBlock[]): Promise<Result<string, SiteEditFailure>> => {
      const { data, error } = await client.rpc('save_site_draft', { p_venue_id: venueId, p_page_id: pageId, p_blocks: blocks.map((block) => ({ ...block })) });
      await reload();
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  const publish = useMutation({
    mutationFn: async (at: Date | null): Promise<Result<null, SiteEditFailure>> => {
      const { error } = await client.rpc('publish_site_draft', { p_venue_id: venueId, p_page_id: pageId, ...(at === null ? {} : { p_publish_at: at.toISOString() }) });
      await reload();
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  const rollback = useMutation({
    mutationFn: async (revisionId: string): Promise<Result<null, SiteEditFailure>> => {
      const { error } = await client.rpc('rollback_site_page', { p_venue_id: venueId, p_page_id: pageId, p_revision_id: revisionId });
      await reload();
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  return { save, publish, rollback };
}
