import { err, ok, type Result } from '@rivr/contracts/result';
import type { VenueConfigChange } from '@rivr/contracts/venueConfig';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The venue configuration as a super admin sees it, bank details and IP allowlist included (#33). */
export interface VenueConfig {
  readonly legalName: string;
  readonly gstin: string | null;
  readonly address: string;
  readonly upiPayeeName: string | null;
  readonly upiVpa: string | null;
  readonly bankName: string | null;
  readonly bankAccountName: string | null;
  readonly bankAccountNumber: string | null;
  readonly bankIfsc: string | null;
  readonly invoicePrefix: string;
  /** Networks the cage and admin screens may be used from (enforced by #384). */
  readonly staffIpAllowlist: readonly string[];
  /** The WhatsApp number alerts go to, `+919876543210`. */
  readonly alertWhatsapp: string | null;
}

/** One chip the venue uses, or used: its value in paise, a multiple of ₹50. */
export interface ChipDenomination {
  readonly chipId: string;
  readonly value: Paise;
  readonly name: string;
  readonly isActive: boolean;
}

/**
 * Why a change did not go through: the role does not configure the venue (super admins only); the
 * database refused a value; a chip of that value is already listed; or anything else.
 */
export type VenueConfigFailure = 'not_allowed' | 'off_networks' | 'invalid' | 'taken' | 'unavailable';

// 22P02: a value Postgres cannot read as its type, such as an IPv6 range that is not its network's start.
const FAILURE_BY_CODE: Readonly<Record<string, VenueConfigFailure>> = {
  '42501': 'not_allowed', RVNET: 'off_networks', '23514': 'invalid', '22P02': 'invalid', '23505': 'taken',
};

/**
 * The venue's configuration for a super admin (`venue_config_detail`, venue.configure); null for anyone
 * else, who reads only what documents show.
 */
export function useVenueConfig(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueConfig(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueConfig | null> => {
      const { data, error } = await client.from('venue_config_detail').select('*').eq('venue_id', venueId).maybeSingle();
      if (error) throw error;
      if (data === null) return null;
      return {
        legalName: data.legal_name ?? '', gstin: data.gstin, address: data.address ?? '', upiPayeeName: data.upi_payee_name, upiVpa: data.upi_vpa,
        bankName: data.bank_name, bankAccountName: data.bank_account_name, bankAccountNumber: data.bank_account_number, bankIfsc: data.bank_ifsc,
        invoicePrefix: data.invoice_prefix ?? '', staffIpAllowlist: (data.staff_ip_allowlist ?? []).map(String), alertWhatsapp: data.alert_whatsapp,
      };
    },
  });
}

/** The venue's chips, smallest first, those out of use included; every staff member reads them. */
export function useChipDenominations(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.chipDenominations(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ChipDenomination[]> => {
      const { data, error } = await client.from('chip_denomination').select('id, value_paise, name, is_active').eq('venue_id', venueId).order('value_paise');
      if (error) throw error;
      return data.map((chip) => ({ chipId: chip.id, value: toPaise(chip.value_paise), name: chip.name, isActive: chip.is_active }));
    },
  });
}

/**
 * Super admins `save` the venue configuration, `addChip` and `setChipActive`; each is audited by the
 * database. An update RLS hides changes no row, which is read as not allowed.
 */
export function useVenueConfigActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });
  const outcome = (error: { code: string } | null, rows: readonly unknown[] | null): Result<null, VenueConfigFailure> => {
    if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
    return rows !== null && rows.length === 1 ? ok(null) : err('not_allowed');
  };
  const save = useMutation({
    mutationFn: async (change: VenueConfigChange) => {
      const { data, error } = await client.from('venue_config').update({
        legal_name: change.legalName, gstin: change.gstin, address: change.address, upi_payee_name: change.upiPayeeName, upi_vpa: change.upiVpa,
        bank_name: change.bankName, bank_account_name: change.bankAccountName, bank_account_number: change.bankAccountNumber, bank_ifsc: change.bankIfsc,
        invoice_prefix: change.invoicePrefix, staff_ip_allowlist: [...change.staffIpAllowlist], alert_whatsapp: change.alertWhatsapp,
      }).eq('venue_id', venueId).select('venue_id');
      await reload(queryKeys.venueConfig(userId ?? 'signed-out', venueId));
      return outcome(error, data);
    },
  });
  const chips = queryKeys.chipDenominations(userId ?? 'signed-out', venueId);
  const addChip = useMutation({
    mutationFn: async ({ value, name }: { value: Paise; name: string }) => {
      const { data, error } = await client.from('chip_denomination').insert({ venue_id: venueId, value_paise: Number(value), name }).select('id');
      await reload(chips);
      return outcome(error, data);
    },
  });
  const setChipActive = useMutation({
    mutationFn: async ({ chipId, isActive }: { chipId: string; isActive: boolean }) => {
      const { data, error } = await client.from('chip_denomination').update({ is_active: isActive }).eq('id', chipId).select('id');
      await reload(chips);
      return outcome(error, data);
    },
  });
  return { save, addChip, setChipActive };
}

/** The club as its printed matter heads it (#69): legal name, address and GSTIN, which every staff member reads. */
export interface VenueIssuer {
  readonly legalName: string;
  readonly address: string;
  readonly gstin?: string | undefined;
}

/** The venue's issuer, for receipts at the cage; null when the venue has no configuration. */
export function useVenueIssuer(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueIssuer(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueIssuer | null> => {
      const { data, error } = await client.from('venue_config').select('legal_name, address, gstin').eq('venue_id', venueId).maybeSingle();
      if (error) throw error;
      return data ? { legalName: data.legal_name, address: data.address, gstin: data.gstin ?? undefined } : null;
    },
  });
}
