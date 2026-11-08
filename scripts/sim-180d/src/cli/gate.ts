/**
 * The gate a run waits for. The owner, 8 Nov: "Start the tests only when everything is committed." Read as:
 * - every PR of the owner's 8 Nov batches is merged, and no other PR is waiting to land;
 * - no worktree of the repository holds uncommitted code: tracked changes, or untracked files outside docs/, other than
 *   untracked scratch folders whose names start with a dot and the known leftovers below;
 * - the harness is committed, pushed and on that main.
 * A dry run during the build needs only the harness committed and pushed.
 */

/** The 8 Nov batches: player app (#840), console lists (#841), bonus chips 2 (#842), console tables (#843). */
export const GATE_PRS: readonly number[] = [840, 841, 842, 843];

/** Untracked folders known to be debris, each with why. */
export const KNOWN_LEFTOVERS: Readonly<Record<string, string>> = {
  'apps/driver/': 'the driver app deleted by decision 0286; its untracked build output stayed in ~/rivr-platform',
};

export interface GateFacts {
  /** `git status --porcelain` lines in the harness worktree. */
  harnessDirty: string[];
  /** HEAD is what origin has for the harness branch. */
  harnessPushed: boolean;
  /** origin/main is an ancestor of HEAD. */
  harnessOnMain: boolean;
  prs: { number: number; title: string; state: string }[];
  /** Open PRs other than the harness's own. */
  openPrs: { number: number; title: string }[];
  /** Every other worktree of the repository, with its `git status --porcelain` lines. */
  worktrees: { path: string; dirty: string[] }[];
}

export interface GateLine {
  check: string;
  ok: boolean;
  detail: string;
}

/** A status line that is not uncommitted code: scratch, notes under docs/, or a known leftover. */
export function isNotCode(line: string): boolean {
  if (!line.startsWith('?? ')) return false;
  const path = line.slice(3);
  return /^\.[^/]+\/?$/.test(path) || path.startsWith('docs/') || path in KNOWN_LEFTOVERS;
}

function harnessLines(facts: GateFacts): GateLine[] {
  return [
    { check: 'harness committed', ok: facts.harnessDirty.length === 0, detail: facts.harnessDirty.join('; ') || 'clean' },
    { check: 'harness pushed', ok: facts.harnessPushed, detail: facts.harnessPushed ? 'origin has HEAD' : 'push chore/sim-180d first' },
  ];
}

function repoLines(facts: GateFacts): GateLine[] {
  const merged = facts.prs.map((pr) => ({ check: `#${pr.number} merged`, ok: pr.state === 'MERGED', detail: `${pr.title} (${pr.state})` }));
  const open = facts.openPrs.map((pr) => `#${pr.number} ${pr.title}`);
  const worktrees = facts.worktrees.map((worktree) => {
    const code = worktree.dirty.filter((line) => !isNotCode(line));
    return { check: `${worktree.path} committed`, ok: code.length === 0, detail: code.join('; ') || 'clean' };
  });
  return [...merged, { check: 'no other PR open', ok: open.length === 0, detail: open.join('; ') || 'none' }, ...worktrees];
}

export function gateLines(facts: GateFacts, mode: 'dry' | 'full'): GateLine[] {
  if (mode === 'dry') return harnessLines(facts);
  const onMain = { check: 'harness on main', ok: facts.harnessOnMain, detail: facts.harnessOnMain ? 'rebased' : 'rebase on origin/main' };
  return [...harnessLines(facts), onMain, ...repoLines(facts)];
}
