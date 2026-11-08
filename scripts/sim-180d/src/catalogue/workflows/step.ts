import type { AppName, Role, WorkflowStep } from '../types.ts';

export function step(actor: Role, app: AppName, screen: string, does: string): WorkflowStep {
  return { actor, app, screen, does };
}

export function refusal(actor: Role, screen: string, expect: string): { actor: Role; screen: string; expect: string } {
  return { actor, screen, expect };
}
