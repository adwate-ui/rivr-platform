/**
 * The venue configuration as a super admin edits it on the console's Settings screen (#33; additions
 * "Venue configuration"). Every field is text as typed; an optional field left empty is null. The
 * database's own checks (20261018090300_venue_config.sql) are the same rules.
 */
import { z } from 'zod';
import { gstinSchema, indianMobileSchema } from './identity.ts';
import { bankAccountNumberSchema, ifscSchema, upiVpaSchema } from './payments.ts';

/** An optional field: empty is null, anything else must pass `schema`. */
const optional = <Schema extends z.ZodType<unknown, string>>(schema: Schema) =>
  z.string().trim().transform((text) => (text === '' ? null : text)).pipe(z.union([z.null(), schema]));

const freeText = (max: number) => z.string().trim().min(1).max(max);

/** Whether an IPv4 range names its network, as Postgres's cidr insists: 203.0.113.0/24, not 203.0.113.5/24. */
function isNetworkAddress(range: string): boolean {
  const [address = '', bits = '32'] = range.split('/');
  const value = address.split('.').reduce((total, part) => total * 256 + Number(part), 0);
  const hostSize = 2 ** (32 - Number(bits));
  return value % hostSize === 0;
}

/** One network the cage and admin screens may be used from: an address, or a range such as 203.0.113.0/24. */
export const networkSchema = z.union([z.cidrv4().refine(isNetworkAddress), z.cidrv6(), z.ipv4(), z.ipv6()]);

/** The venue configuration form. The IP allowlist is typed as a list split by commas or spaces. */
export const venueConfigSchema = z.strictObject({
  legalName: freeText(200),
  gstin: optional(gstinSchema),
  address: freeText(500),
  upiPayeeName: optional(freeText(100)),
  upiVpa: optional(upiVpaSchema),
  bankName: optional(freeText(100)),
  bankAccountName: optional(freeText(100)),
  bankAccountNumber: optional(bankAccountNumberSchema),
  bankIfsc: optional(ifscSchema),
  // Six characters at most, so an invoice number stays within GST's sixteen (#23).
  invoicePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,6}$/),
  staffIpAllowlist: z.string().transform((text) => text.split(/[\s,]+/).filter((part) => part !== '')).pipe(z.array(networkSchema).max(50)),
  alertWhatsapp: optional(indianMobileSchema),
});

/** The form as typed. */
export type VenueConfigInput = z.input<typeof venueConfigSchema>;
/** The form as saved. */
export type VenueConfigChange = z.output<typeof venueConfigSchema>;

/** A new chip: its value in whole rupees, a multiple of ₹50 up to ₹10 lakh, and its name. */
export const chipAddSchema = z.strictObject({
  rupees: z.string().trim().regex(/^[1-9][0-9]{1,6}$/).refine((text) => Number(text) % 50 === 0 && Number(text) <= 1_000_000),
  name: freeText(40),
});
