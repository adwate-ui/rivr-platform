import { createElement, type ComponentType, type ReactElement } from 'react';
import { decodeJobJson } from '../job.ts';
import { isTemplateName, templates } from '../templates/index.ts';

/**
 * Reads the job from the host page's query string and returns the template element to mount.
 * The props were typed against the template by `renderToPng` in Node, so this boundary trusts
 * their shape once the template name checks out.
 */
export function parseHostJob(search: string): ReactElement {
  const text = new URLSearchParams(search).get('job');
  if (!text) throw new Error('The render host needs a ?job= parameter.');
  const job = decodeJobJson(text) as { template: string; props: object };
  if (!isTemplateName(job.template)) throw new Error(`Unknown render template "${job.template}".`);
  const template = templates[job.template] as ComponentType<object>;
  return createElement(template, job.props);
}
