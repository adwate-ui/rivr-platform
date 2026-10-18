#!/usr/bin/env node
/**
 * Deploys built apps to Cloudflare Pages, one project per app and environment:
 *   preview     rivr-<app>-staging, branch pr-<n>   (a preview URL per pull request)
 *   staging     rivr-<app>-staging, branch main     (every merge to main)
 *   production  rivr-<app>,         branch main     (a release-* tag)
 * Usage: node scripts/ci/pages-deploy.mjs <environment> <branch> <app> [<app>...]
 * `storybook` deploys packages/ui/storybook-static to rivr-storybook.
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const [environment, branch, ...apps] = process.argv.slice(2);
const WRANGLER = 'node_modules/.bin/wrangler';

function projectName(app) {
  if (app === 'storybook') return 'rivr-storybook';
  return environment === 'production' ? `rivr-${app}` : `rivr-${app}-staging`;
}

function outputDir(app) {
  return app === 'storybook' ? 'packages/ui/storybook-static' : `apps/${app}/dist`;
}

function wrangler(args) {
  const result = spawnSync(WRANGLER, args, { encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Deploys one app and returns its URL; creates the Pages project on first use. */
function deploy(app) {
  const project = projectName(app);
  const created = wrangler(['pages', 'project', 'create', project, '--production-branch', 'main']);
  if (!created.ok && !/already exists/i.test(created.output)) process.stdout.write(created.output);
  const deployed = wrangler(['pages', 'deploy', outputDir(app), '--project-name', project, '--branch', branch, '--commit-dirty=true']);
  process.stdout.write(deployed.output);
  if (!deployed.ok) throw new Error(`Deploying ${app} to ${project} failed.`);
  return deployed.output.match(/https:\/\/\S+\.pages\.dev/)?.[0] ?? '(URL not printed)';
}

if (!['preview', 'staging', 'production'].includes(environment ?? '') || !branch || apps.length === 0) {
  process.stderr.write('Usage: pages-deploy.mjs <preview|staging|production> <branch> <app>...\n');
  process.exit(2);
}
const lines = apps.map((app) => `| ${app} | ${deploy(app)} |`);
const summary = [`### Cloudflare Pages (${environment}, ${branch})`, '', '| App | URL |', '|---|---|', ...lines, ''].join('\n');
process.stdout.write(`${summary}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
