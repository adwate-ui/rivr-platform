import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/glaza).
const keys = { statement: (userId: string, venueId: string, month: string) => ['user', userId, 'glaza-statement', venueId, month] as const };

/** What a line of Glaza's is: food, a soft drink or alcohol. */
export type GlazaKind = 'food' | 'soft_drink' | 'alcohol';

/** One line of Glaza's file (#109): an item sold or comped, when (IST, with its offset) and where, and its unit cost and price. */
export interface GlazaLine {
  readonly soldAt: string;
  readonly tableName: string;
  /** Null when Glaza's file does not give the seat. */
  readonly seat: number | null;
  readonly item: string;
  readonly kind: GlazaKind;
  readonly quantity: number;
  readonly unitCost: Paise;
  readonly unitPrice: Paise;
  readonly isComp: boolean;
}

/** A club month's statement from its latest import (#109; decision 0265): the comps at cost, the alcohol margin, and the payable. */
export interface GlazaStatement {
  readonly importedAt: string;
  readonly lines: number;
  /** The lines matched to a visit by table and time. */
  readonly matched: number;
  readonly foodComps: Paise;
  readonly softDrinkComps: Paise;
  readonly alcoholComps: Paise;
  readonly comps: Paise;
  readonly alcoholSales: Paise;
  readonly alcoholCost: Paise;
  readonly alcoholMargin: Paise;
  readonly rivrShare: Paise;
  /** NewCo's payable to Glaza: below nothing when Glaza owes RIVR. */
  readonly payable: Paise;
}

/** Why an import did not go through: the role, a line out of bounds or outside the month, the venue frozen, or anything else. */
export type GlazaFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, GlazaFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

const paise = (amount: number) => fromPaise(BigInt(amount));

/** A club month's statement (the month as its 1st, `2026-11-01`) for staff who run F&B; null while the month has no import. */
export function useGlazaStatement(venueId: string, month: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.statement(userId ?? 'signed-out', venueId, month),
    enabled: userId !== null,
    queryFn: async (): Promise<GlazaStatement | null> => {
      const { data, error } = await client.rpc('glaza_statement', { p_venue_id: venueId, p_month: month });
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return {
        importedAt: row.imported_at, lines: row.lines, matched: row.matched, foodComps: paise(row.food_comps_paise),
        softDrinkComps: paise(row.soft_drink_comps_paise), alcoholComps: paise(row.alcohol_comps_paise), comps: paise(row.comps_paise),
        alcoholSales: paise(row.alcohol_sales_paise), alcoholCost: paise(row.alcohol_cost_paise), alcoholMargin: paise(row.alcohol_margin_paise),
        rivrShare: paise(row.rivr_share_paise), payable: paise(row.payable_paise),
      };
    },
  });
}

/** Imports a club month of Glaza's lines, matched to visits by table and time; a Result, and the month's statement reloads. */
export function useImportGlaza(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, lines }: { month: string; lines: readonly GlazaLine[] }): Promise<Result<string, GlazaFailure>> => {
      const { data, error } = await client.rpc('import_glaza_lines', {
        p_venue_id: venueId, p_month: month,
        p_lines: lines.map((line) => ({
          sold_at: line.soldAt, table_name: line.tableName, seat: line.seat, item: line.item, kind: line.kind, quantity: line.quantity,
          unit_cost_paise: Number(line.unitCost), unit_price_paise: Number(line.unitPrice), is_comp: line.isComp,
        })),
      });
      await queryClient.invalidateQueries({ queryKey: keys.statement(userId ?? 'signed-out', venueId, month) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}
