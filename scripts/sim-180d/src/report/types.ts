import type { AppName, Role } from '../catalogue/types.ts';

/** P0: money, identity or privacy wrong, or a workflow that cannot finish. P1: someone blocked or misled, or WCAG A.
 * P2: friction, inconsistency, or WCAG AA. P3: polish. */
export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export type Lens = 'function' | 'workflow' | 'copy' | 'design' | 'a11y' | 'speed' | 'code' | 'security' | 'benchmark';

/** One finding, as the review records it and the tracker shows it. */
export interface Finding {
  /** F-001 onwards, by severity. */
  id: string;
  severity: Severity;
  /** Not a bug, but short of the benchmark. */
  worldClassGap: boolean;
  app: AppName;
  role: Role;
  workflow?: string;
  screen?: string;
  lens: Lens;
  /** One sentence. */
  title: string;
  /** Capture paths, log lines, file:line. */
  evidence: string[];
  /** file:line, confirmed. */
  rootCause?: string;
  fix: string;
  prGroup?: string;
  verdict?: 'confirmed' | 'rejected';
}
