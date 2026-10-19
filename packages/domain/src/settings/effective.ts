/** One effective-dated rule: from a moment on (ISO 8601), or null for one in force since the venue opened. */
export interface Dated {
  readonly effectiveFrom: string | null;
}

/** The rule in force at a moment, and the changes still to come after it, soonest first. */
export interface RuleAt<Rule> {
  readonly inForce: Rule | null;
  readonly scheduled: readonly Rule[];
}

const startOf = (rule: Dated) => (rule.effectiveFrom === null ? Number.NEGATIVE_INFINITY : Date.parse(rule.effectiveFrom));

/**
 * The rule in force at `at` (.claude/rules/money.md): the newest whose start is not after it, as the
 * database's private.setting_at finds it, so a hand keeps the rule it was played under. The changes
 * that start after `at` follow, soonest first. Rows come in any order.
 */
export function ruleAt<Rule extends Dated>(rules: readonly Rule[], at: Date): RuleAt<Rule> {
  const moment = at.getTime();
  const newestFirst = [...rules].sort((a, b) => startOf(b) - startOf(a));
  return {
    inForce: newestFirst.find((rule) => startOf(rule) <= moment) ?? null,
    scheduled: newestFirst.filter((rule) => startOf(rule) > moment).reverse(),
  };
}
