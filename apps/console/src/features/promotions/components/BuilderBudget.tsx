import type { PromotionBudget } from '@rivr/db';
import { parseRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Inline, Input } from '@rivr/ui';

/** The budget as typed: an amount in bonus chips, and the most grants; either may be left empty. */
export interface TypedBudget {
  readonly amount: string;
  readonly grants: string;
}

export const NO_BUDGET: TypedBudget = { amount: '', grants: '' };

// The most a builder promotion's budget may be: a crore of bonus chips, and a hundred thousand grants.
const MOST_PAISE = 1_000_000_000n;
const MOST_GRANTS = 100_000;

/** The amount typed, in paise: null when empty, undefined when it is no whole number of chips from 1 to a crore. */
function paiseOf(amount: string): bigint | null | undefined {
  if (amount === '') return null;
  const paise = parseRupees(amount);
  return paise.ok && paise.value > 0n && paise.value <= MOST_PAISE && paise.value % 100n === 0n ? paise.value : undefined;
}

/** The most grants typed: null when empty, undefined when it is no whole number from 1 to a hundred thousand. */
function countOf(grants: string): number | null | undefined {
  if (grants === '') return null;
  const count = Number(grants);
  return Number.isSafeInteger(count) && count > 0 && count <= MOST_GRANTS ? count : undefined;
}

/** The typed budget as sent: null when nothing is typed, undefined when a part is no amount or no whole number. */
export function budgetOf(typed: TypedBudget): PromotionBudget | null | undefined {
  const [paise, count] = [paiseOf(typed.amount.trim()), countOf(typed.grants.trim())];
  if (paise === undefined || count === undefined) return undefined;
  return paise === null && count === null ? null : { paise, count };
}

/** A builder promotion's optional budget (A2-04): what it may give in bonus chips, and how many times, whichever comes first. */
export function BuilderBudget({ value, isDisabled, onChange }: { value: TypedBudget; isDisabled: boolean; onChange: (next: TypedBudget) => void }) {
  return (
    <Inline gap={4} wrap>
      <Input label={t('console.promotions.budget')} value={value.amount} inputMode="decimal" autoComplete="off" disabled={isDisabled}
        onChange={(event) => onChange({ ...value, amount: event.target.value })} />
      <Input label={t('console.promotions.budgetGrants')} value={value.grants} inputMode="numeric" autoComplete="off" disabled={isDisabled}
        onChange={(event) => onChange({ ...value, grants: event.target.value })} />
    </Inline>
  );
}
