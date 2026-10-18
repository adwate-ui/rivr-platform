import { paiseSchema, type Paise } from '@rivr/contracts';

/**
 * A fixture amount in paise; the comment beside each use gives it in rupees. Fixtures cannot use
 * `@rivr/domain/money`, because the domain's own tests import this package (docs/decisions/0013).
 */
export function paise(value: bigint): Paise {
  return paiseSchema.parse(value);
}
