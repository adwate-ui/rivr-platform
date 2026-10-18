/**
 * Fails when generated/ is out of date with tokens.json: it regenerates every output, then
 * asks git whether anything under generated/ is modified, deleted or not yet committed.
 * CI runs it through `pnpm verify` whenever packages/tokens changes.
 */
import { execFileSync } from 'node:child_process';

execFileSync('node', ['style-dictionary.config.mjs'], { stdio: 'inherit' });

const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'generated'], {
  encoding: 'utf8',
}).trim();

if (changes) {
  process.stderr.write(
    `Generated token files differ from tokens.json or are not committed:\n${changes}\n` +
      'Run `pnpm --filter @rivr/tokens build` and commit packages/tokens/generated.\n',
  );
  process.exit(1);
}
process.stdout.write('Generated token files are current.\n');
