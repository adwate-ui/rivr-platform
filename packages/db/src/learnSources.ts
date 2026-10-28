import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/learnSources).
const keys = { sources: (userId: string, venueId: string) => ['user', userId, 'learn-sources', venueId] as const };
const BUCKET = 'learn-sources';

/** A licensed Learn source the venue holds (#131): what it is, which file was accepted, and its licence. */
export interface LearnSource {
  readonly sourceKey: string;
  readonly title: string;
  readonly author: string | null;
  readonly licenceTerms: string;
  /** The licence's last day, `2027-03-31`: from the next, no one has the source. */
  readonly licenceEndsOn: string;
}

/** An encoding that passed the validator and the gates, with its licence, to upload and register. */
export interface NewLearnSource extends LearnSource {
  /** The encoding's text, uploaded as it was checked. */
  readonly raw: string;
  /** @rivr/drills hashSource of it. */
  readonly sourceHash: string;
}

/** Why a source was not taken: not a super admin, out of bounds, the venue frozen, or anything else. */
export type LearnSourceFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, LearnSourceFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

/** The venue's Learn sources, for a super admin. */
export function useLearnSources(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.sources(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<LearnSource[]> => {
      const { data, error } = await client.from('learn_source').select('source_key, title, author, licence_terms, licence_ends_on')
        .eq('venue_id', venueId).order('title');
      if (error) throw error;
      return data.map((row) => ({
        sourceKey: row.source_key, title: row.title, author: row.author, licenceTerms: row.licence_terms, licenceEndsOn: row.licence_ends_on,
      }));
    },
  });
}

/** Uploads a checked encoding to the private bucket, then registers it with its licence; a Result, and the list reloads. */
export function useAddLearnSource(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: NewLearnSource): Promise<Result<null, LearnSourceFailure>> => {
      const file = new Blob([source.raw], { type: 'application/json' });
      const stored = await client.storage.from(BUCKET).upload(`${venueId}/${source.sourceKey}.json`, file, { contentType: 'application/json', upsert: true });
      if (stored.error) return err('unavailable');
      const { error } = await client.rpc('register_learn_source', {
        p_venue_id: venueId, p_source_key: source.sourceKey, p_title: source.title, p_author: source.author ?? '', p_source_hash: source.sourceHash,
        p_licence_terms: source.licenceTerms, p_licence_ends_on: source.licenceEndsOn,
      });
      await queryClient.invalidateQueries({ queryKey: keys.sources(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
