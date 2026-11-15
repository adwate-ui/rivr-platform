/**
 * The venue configuration as a super admin edits it on the console's Settings screen (#33; additions
 * "Venue configuration"). Every field is text as typed; an optional field left empty is null. The
 * database's own checks (20261018090300_venue_config.sql) are the same rules.
 */
import { z } from 'zod';
import { gstinSchema, indianMobileSchema } from './identity.ts';
import { bankAccountNumberSchema, ifscSchema, upiVpaSchema } from './payments.ts';

/** A TAN, the number TDS returns and certificates name the deductor by: four letters, five digits, a letter, `DELR12345E` (#93). */
export const tanSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}[0-9]{5}[A-Z]$/);

/**
 * A number the club is called on, a mobile or a landline: +91 and ten digits, typed with +91, a landline's trunk 0 or neither,
 * `0124 400 0000` to `+911244000000` (decision 0582).
 */
export const indianPhoneSchema = z.string().overwrite((text) => text.replace(/[\s-]/g, '')).regex(/^(?:\+91|0)?[1-9]\d{9}$/)
  .transform((text) => `+91${text.slice(-10)}`);

/** A SAC code, the services code a tax invoice carries for its series: four or six digits, `999692` (#423). */
export const sacSchema = z.string().trim().regex(/^[0-9]{4}([0-9]{2})?$/);

/** An optional field: empty is null, anything else must pass `schema`. */
const optional = <Schema extends z.ZodType<unknown, string>>(schema: Schema) =>
  z.string().trim().transform((text) => (text === '' ? null : text)).pipe(z.union([z.null(), schema]));

const freeText = (max: number) => z.string().trim().min(1).max(max);

/** The venue configuration form. */
export const venueConfigSchema = z.strictObject({
  legalName: freeText(200),
  gstin: optional(gstinSchema),
  // The TAN TDS returns and certificates name the venue by (#93).
  tan: optional(tanSchema),
  address: freeText(500),
  upiPayeeName: optional(freeText(100)),
  upiVpa: optional(upiVpaSchema),
  bankName: optional(freeText(100)),
  bankAccountName: optional(freeText(100)),
  bankAccountNumber: optional(bankAccountNumberSchema),
  bankIfsc: optional(ifscSchema),
  // Six characters at most, so an invoice number stays within GST's sixteen (#23).
  invoicePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,6}$/),
  alertWhatsapp: optional(indianMobileSchema),
  // The club's numbers members and visitors call and WhatsApp, on the website and in the app (decision 0582).
  contactPhone: optional(indianPhoneSchema),
  contactWhatsapp: optional(indianMobileSchema),
  // The SAC code of each invoice series, from the CA, and the authorised signatory every tax invoice names (#423).
  sacClubServices: optional(sacSchema),
  signatoryName: optional(freeText(100)),
  signatoryDesignation: optional(freeText(100)),
});

/** The form as typed. */
export type VenueConfigInput = z.input<typeof venueConfigSchema>;
/** The form as saved. */
export type VenueConfigChange = z.output<typeof venueConfigSchema>;
