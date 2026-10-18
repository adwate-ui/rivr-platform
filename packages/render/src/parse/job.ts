import type { Locale } from '@rivr/i18n';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { decodeJobJson } from '../job.ts';
import { isTemplateName, templates } from '../templates/index.ts';

/** The template element to mount and the language to mount it in. */
export interface HostJob {
  element: ReactElement;
  locale: Locale;
}

/**
 * Reads the job from the host page's query string. The props were typed against the template
 * by `renderToPng` in Node, so this boundary trusts their shape once the template name checks out.
 */
export function parseHostJob(search: string): HostJob {
  const text = new URLSearchParams(search).get('job');
  if (!text) throw new Error('The render host needs a ?job= parameter.');
  const job = decodeJobJson(text) as { template: string; props: object; locale: string };
  if (!isTemplateName(job.template)) throw new Error(`Unknown render template "${job.template}".`);
  const template = templates[job.template] as ComponentType<object>;
  return { element: createElement(template, job.props), locale: job.locale === 'hi' ? 'hi' : 'en' };
}
