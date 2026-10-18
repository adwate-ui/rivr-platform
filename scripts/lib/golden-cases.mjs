/**
 * Loads the golden files (packages/testing/golden/*.json) into this worktree's local database before
 * pgTAP runs, as test data only (#221, decision 0037). A SQL twin of a money rule is then proved
 * against the very cases @rivr/domain is, so a case added to a file is tested on both sides. Never a
 * migration: the `golden` schema exists only in a local database, and `db reset` drops it.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worktreeName } from '@rivr/config/worktree';

export function loadGoldenCases(root) {
  const dir = join(root, 'packages/testing/golden');
  const cases = readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')).cases.map((goldenCase, position) => ({ file, position, ...goldenCase })));
  // One JSON literal, dollar-quoted: no case text is ever spliced into the SQL.
  const sql = `
    create schema if not exists golden;
    create table if not exists golden.golden_case (
      file text, position integer, description text, operation text, inputs jsonb, expected jsonb, primary key (file, position));
    truncate golden.golden_case;
    insert into golden.golden_case
    select c.file, c.position, c.description, c.operation, c.inputs, c.expected
    from jsonb_to_recordset($golden_cases$${JSON.stringify(cases)}$golden_cases$::jsonb)
      as c (file text, position integer, description text, operation text, inputs jsonb, expected jsonb);
  `;
  execFileSync('docker', ['exec', '-i', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
}
