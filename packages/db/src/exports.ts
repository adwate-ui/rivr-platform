import { useCallback } from 'react';
import { useRivrData } from './provider.tsx';

/** What a console table's export records (#102): the table, every filter in force, the format and the rows. */
export interface TableExportRecord {
  readonly what: string;
  readonly filter: string;
  readonly format: 'csv' | 'xlsx';
  readonly rows: number;
}

/**
 * Records a console table's export in the audit log before its file is saved (#102), alerting the owner
 * when it is large: resolves true once recorded, false when it was not, and then nothing is saved.
 * Its own subpath (@rivr/db/exports), off the player's first load.
 */
export function useRecordTableExport(venueId: string) {
  const { client } = useRivrData();
  return useCallback(async ({ what, filter, format, rows }: TableExportRecord): Promise<boolean> => {
    const { error } = await client.rpc('record_table_export', { p_venue_id: venueId, p_what: what, p_filter: filter, p_format: format, p_rows: rows });
    return error === null;
  }, [client, venueId]);
}
