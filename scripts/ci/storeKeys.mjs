/**
 * Whether a store build's keys are set (decision 0577). None set means the accounts do not exist yet, so the build is skipped and
 * the release carries on. Some set is a mistake, so the release stops and names what is missing. Only names, never values.
 */
export function keysState(names, env) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length === 0) return { present: true, missing: [] };
  return { present: false, missing: missing.length === names.length ? [] : missing };
}
