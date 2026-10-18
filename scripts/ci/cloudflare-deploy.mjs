#!/usr/bin/env node
/**
 * Deploys built apps to Cloudflare, one project per app and environment:
 *   preview     rivr-<app>-staging, a preview per pull request (branch or alias pr-<n>)
 *   staging     rivr-<app>-staging, on every merge to main
 *   production  rivr-<app>, on a release-* tag
 * The Vite apps and Storybook go to Cloudflare Pages; the website is an Astro app on a
 * Cloudflare Worker (docs/decisions/0021-website-on-a-cloudflare-worker.md).
 * Usage: node scripts/ci/cloudflare-deploy.mjs <environment> <branch> <app> [<app>...]
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const [environment, branch, ...apps] = process.argv.slice(2);
const WRANGLER = join(process.cwd(), 'node_modules/.bin/wrangler');

function projectName(app) {
  if (app === 'storybook') return 'rivr-storybook';
  return environment === 'production' ? `rivr-${app}` : `rivr-${app}-staging`;
}

function wrangler(args, cwd = process.cwd()) {
  const result = spawnSync(WRANGLER, args, { encoding: 'utf8', cwd });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  return { ok: result.status === 0, output };
}

/** The website: a Worker built by the Astro adapter, deployed from apps/web. */
function deployWorker(app) {
  const name = projectName(app);
  const args = environment === 'preview'
    ? ['versions', 'upload', '--name', name, '--preview-alias', branch]
    : ['deploy', '--name', name];
  const result = wrangler(args, join(process.cwd(), 'apps', app));
  if (!result.ok) throw new Error(`Deploying ${app} to ${name} failed.`);
  return result.output.match(/https:\/\/\S+\.workers\.dev/)?.[0] ?? '(URL not printed)';
}

/** A static app on Pages; creates the project on first use. */
function deployPages(app) {
  const project = projectName(app);
  const created = wrangler(['pages', 'project', 'create', project, '--production-branch', 'main']);
  if (!created.ok && !/already exists/i.test(created.output)) throw new Error(`Creating ${project} failed.`);
  const directory = app === 'storybook' ? 'packages/ui/storybook-static' : `apps/${app}/dist`;
  const result = wrangler(['pages', 'deploy', directory, '--project-name', project, '--branch', branch, '--commit-dirty=true']);
  if (!result.ok) throw new Error(`Deploying ${app} to ${project} failed.`);
  return result.output.match(/https:\/\/\S+\.pages\.dev/)?.[0] ?? '(URL not printed)';
}

if (!['preview', 'staging', 'production'].includes(environment ?? '') || !branch || apps.length === 0) {
  process.stderr.write('Usage: cloudflare-deploy.mjs <preview|staging|production> <branch> <app>...\n');
  process.exit(2);
}
const lines = apps.map((app) => `| ${app} | ${app === 'web' ? deployWorker(app) : deployPages(app)} |`);
const summary = [`### Cloudflare (${environment}, ${branch})`, '', '| App | URL |', '|---|---|', ...lines, ''].join('\n');
process.stdout.write(`${summary}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
