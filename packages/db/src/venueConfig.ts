import { err, ok, type Result } from '@rivr/contracts/result';
import type { VenueConfigChange } from '@rivr/contracts/venueConfig';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The venue configuration as a super admin sees it, bank details included (#33). */
export interface VenueConfig {
  readonly legalName: string;
  readonly gstin: string | null;
  /** The TAN its TDS returns and certificates name it by (#93). */
  readonly tan: string | null;
  readonly address: string;
  readonly upiPayeeName: string | null;
  readonly upiVpa: string | null;
  readonly bankName: string | null;
  readonly bankAccountName: string | null;
  readonly bankAccountNumber: string | null;
  readonly bankIfsc: string | null;
  readonly invoicePrefix: string;
  /** The WhatsApp number alerts go to, `+919876543210`. */
  readonly alertWhatsapp: string | null;
  /** The club's numbers members and visitors call and WhatsApp (decision 0582), `+918796580435`. */
  readonly contactPhone: string | null;
  readonly contactWhatsapp: string | null;
  /** The SAC code of the club services (S) invoice series, and the authorised signatory (#423). */
  readonly sacClubServices: string | null;
  readonly signatoryName: string | null;
  readonly signatoryDesignation: string | null;
  /** The venue's logo in the public brand bucket (#397), or null until one is uploaded. */
  readonly logoUrl: string | null;
}

/** Why a logo did not go through: not a PNG, over 1 MB, the role does not configure the venue, or anything else. */
export type VenueLogoFailure = 'wrong_type' | 'too_big' | 'not_allowed' | 'unavailable';

// The brand bucket takes these, up to 1 MB (supabase/migrations/20261027000300_venue_logo.sql).
const BRAND_BUCKET = 'brand';
const LOGO_EXTENSION: Readonly<Record<string, string>> = { 'image/png': 'png' };
const LOGO_MAX_BYTES = 1_048_576;

/**
 * Why a change did not go through: the role does not configure the venue (super admins only); the
 * database refused a value; or anything else.
 */
export type VenueConfigFailure = 'not_allowed' | 'invalid' | 'unavailable';

// 22P02: a value Postgres cannot read as its type.
const FAILURE_BY_CODE: Readonly<Record<string, VenueConfigFailure>> = {
  '42501': 'not_allowed', '23514': 'invalid', '22P02': 'invalid',
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
        legalName: data.legal_name ?? '', gstin: data.gstin, tan: data.tan, address: data.address ?? '', upiPayeeName: data.upi_payee_name, upiVpa: data.upi_vpa,
        bankName: data.bank_name, bankAccountName: data.bank_account_name, bankAccountNumber: data.bank_account_number, bankIfsc: data.bank_ifsc,
        invoicePrefix: data.invoice_prefix ?? '', alertWhatsapp: data.alert_whatsapp,
        contactPhone: data.contact_phone, contactWhatsapp: data.contact_whatsapp,
        sacClubServices: data.sac_club_services, signatoryName: data.signatory_name, signatoryDesignation: data.signatory_designation,
        logoUrl: data.logo_path === null ? null : client.storage.from(BRAND_BUCKET).getPublicUrl(data.logo_path).data.publicUrl,
      };
    },
  });
}

/**
 * Super admins `save` the venue configuration, which the database audits. An update RLS hides changes
 * no row, which is read as not allowed.
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
        legal_name: change.legalName, gstin: change.gstin, tan: change.tan, address: change.address, upi_payee_name: change.upiPayeeName, upi_vpa: change.upiVpa,
        bank_name: change.bankName, bank_account_name: change.bankAccountName, bank_account_number: change.bankAccountNumber, bank_ifsc: change.bankIfsc,
        invoice_prefix: change.invoicePrefix, alert_whatsapp: change.alertWhatsapp,
        contact_phone: change.contactPhone, contact_whatsapp: change.contactWhatsapp,
        sac_club_services: change.sacClubServices, signatory_name: change.signatoryName,
        signatory_designation: change.signatoryDesignation,
      }).eq('venue_id', venueId).select('venue_id');
      await reload(queryKeys.venueConfig(userId ?? 'signed-out', venueId));
      return outcome(error, data);
    },
  });
  return { save };
}

/**
 * A super admin uploads the venue's logo, a PNG of up to 1 MB (#397): it goes up under a name of its
 * own, then the database makes it the venue's logo. Both are audited.
 */
export function useVenueLogoUpload(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (logo: File): Promise<Result<null, VenueLogoFailure>> => {
      const extension = LOGO_EXTENSION[logo.type];
      if (extension === undefined) return err('wrong_type');
      if (logo.size > LOGO_MAX_BYTES) return err('too_big');
      const path = `${venueId}/logo-${crypto.randomUUID()}.${extension}`;
      const upload = await client.storage.from(BRAND_BUCKET).upload(path, logo, { contentType: logo.type });
      if (upload.error) return err('unavailable');
      const { error } = await client.rpc('set_venue_logo', { p_venue_id: venueId, p_path: path });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueConfig(userId ?? 'signed-out', venueId) });
      if (error) return err(error.code === '42501' ? 'not_allowed' : 'unavailable');
      return ok(null);
    },
  });
}
