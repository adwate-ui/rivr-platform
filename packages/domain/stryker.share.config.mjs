// @ts-check
/**
 * A CI mutation share (#515): Stryker's config without its run-wide break, because a share holds parts of several
 * modules and its run as a whole says nothing about any one of them. The floor is not lowered: CI's mutation-score
 * job holds every module, scored whole over every share's report, to the same thresholds.break (decision 0243).
 * Run with `pnpm --filter @rivr/domain exec stryker run stryker.share.config.mjs --mutate <files>`.
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
import base from './stryker.config.mjs';

export default { ...base, thresholds: { ...base.thresholds, break: null } };
