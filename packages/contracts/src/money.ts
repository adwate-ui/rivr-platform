import { z } from 'zod';

// Digits only, an optional minus, no leading zeros: the text Postgres returns for a bigint column.
const INTEGER_TEXT = /^-?(0|[1-9]\d*)$/;

/**
 * Integer paise from a bigint, or from an integer string as Postgres returns `bigint` columns.
 * JavaScript numbers are rejected: above 2^53 they lose paise without any error.
 */
export const paiseSchema = z
  .union([z.bigint(), z.string().regex(INTEGER_TEXT).transform((text) => BigInt(text))])
  .brand<'Paise'>();

/** Money as integer paise (₹1 is 100 paise). Build and combine it only through `@rivr/domain/money`. */
export type Paise = z.infer<typeof paiseSchema>;
