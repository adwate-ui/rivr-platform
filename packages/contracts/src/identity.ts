import { z } from 'zod';

const SPACES_AND_HYPHENS = /[\s-]/g;
// Ten digits starting 6 to 9, with or without +91 in front.
const INDIAN_MOBILE = /^(?:\+91)?([6-9]\d{9})$/;
// Five letters (the fourth is the holder type: P person, C company, H HUF and so on), four digits, a letter.
const PAN = /^[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]$/;
// State code, PAN, entity number, the letter Z, check character.
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** An Indian mobile number in E.164 form, `+919876543210`, from what a person typed. */
export const indianMobileSchema = z
  .string()
  .overwrite((text) => text.replace(SPACES_AND_HYPHENS, ''))
  .regex(INDIAN_MOBILE)
  .transform((text) => `+91${text.slice(-10)}`)
  .brand<'IndianMobile'>();
/** An Indian mobile number, `+919876543210`. */
export type IndianMobile = z.infer<typeof indianMobileSchema>;

/** A PAN in capitals, `ABCPE1234F`. */
export const panSchema = z.string().trim().toUpperCase().regex(PAN).brand<'Pan'>();
/** A PAN. */
export type Pan = z.infer<typeof panSchema>;

/** The GSTIN check character: a weighted base-36 sum of the first fourteen characters. */
function gstinCheckCharacter(gstin: string): string {
  let total = 0;
  for (let index = 0; index < 14; index += 1) {
    const product = GSTIN_ALPHABET.indexOf(gstin.charAt(index)) * (index % 2 === 0 ? 1 : 2);
    total += Math.trunc(product / 36) + (product % 36);
  }
  return GSTIN_ALPHABET.charAt((36 - (total % 36)) % 36);
}

/** A GSTIN in capitals whose check character is right, `27AAPFU0939F1ZV`. */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN)
  .refine((gstin) => gstin.charAt(14) === gstinCheckCharacter(gstin), 'GSTIN check character does not match')
  .brand<'Gstin'>();
/** A GSTIN. */
export type Gstin = z.infer<typeof gstinSchema>;
