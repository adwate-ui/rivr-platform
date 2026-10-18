// @ts-check
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

/** Lints `code` as if it were the file at `path` (relative to the repo root) and returns the rule ids hit. */
async function ruleIdsFor(path, code) {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}/${path}` });
  return (result?.messages ?? []).map((message) => message.ruleId);
}

const PLAYER_ROUTE = 'apps/player/src/routes/home.tsx';

describe('apps never draw or style', () => {
  it('rejects a raw HTML element', async () => {
    expect(await ruleIdsFor(PLAYER_ROUTE, 'export const Home = () => <div />;\n')).toContain('react/forbid-elements');
  });

  it('rejects className and style on a component', async () => {
    const ids = await ruleIdsFor(PLAYER_ROUTE, 'import { Stack } from "@rivr/ui";\nexport const Home = () => <Stack className="p-4" style={{}} />;\n');
    expect(ids.filter((id) => id === 'react/forbid-component-props')).toHaveLength(2);
  });

  it('rejects Radix, icon sets and the Supabase client', async () => {
    const code = 'import "@radix-ui/react-dialog";\nimport "lucide-react";\nimport "@supabase/supabase-js";\n';
    expect((await ruleIdsFor('apps/console/src/features/cage/x.ts', code)).filter((id) => id === 'no-restricted-imports')).toHaveLength(3);
  });

  it('rejects literal copy in JSX', async () => {
    const ids = await ruleIdsFor(PLAYER_ROUTE, 'import { Text } from "@rivr/ui";\nexport const Home = () => <Text>Your seat is ready</Text>;\n');
    expect(ids).toContain('i18next/no-literal-string');
  });

  it('accepts a screen composed from @rivr/ui with copy from @rivr/i18n', async () => {
    const code = 'import { Text } from "@rivr/ui";\nimport { t } from "@rivr/i18n";\nexport const Home = () => <Text variant="body">{t("home.title")}</Text>;\n';
    expect(await ruleIdsFor(PLAYER_ROUTE, code)).toEqual([]);
  });
});

describe('raw design values live only in tokens', () => {
  it('rejects a hex colour outside packages/tokens', async () => {
    expect(await ruleIdsFor('packages/ui/src/Button/Button.tsx', 'export const gold = "#C9A85C";\n')).toContain('no-restricted-syntax');
  });

  it('rejects an arbitrary Tailwind value but allows a data variant', async () => {
    expect(await ruleIdsFor('packages/ui/src/Box/Box.tsx', 'export const c = "p-2 w-[13px]";\n')).toContain('no-restricted-syntax');
    expect(await ruleIdsFor('packages/ui/src/Box/Box.tsx', 'export const c = "data-[state=open]:bg-raised";\n')).toEqual([]);
  });

  it('allows hex colours in packages/tokens', async () => {
    expect(await ruleIdsFor('packages/tokens/src/check.ts', 'export const gold = "#C9A85C";\n')).toEqual([]);
  });
});

describe('type safety and clarity', () => {
  it('rejects any, non-null assertions and type assertions outside parse/', async () => {
    const code = 'export const f = (x: any, y?: string) => (x as string) + y!;\n';
    const ids = await ruleIdsFor('packages/domain/src/money/money.ts', code);
    expect(ids).toEqual(expect.arrayContaining([
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-non-null-assertion',
      '@typescript-eslint/consistent-type-assertions',
    ]));
  });

  it('allows type assertions under parse/', async () => {
    expect(await ruleIdsFor('packages/db/src/parse/member.ts', 'export const f = (x: unknown) => x as string;\n')).toEqual([]);
  });

  it('rejects console and a TODO without an issue', async () => {
    const ids = await ruleIdsFor('packages/domain/src/x.ts', '// TODO tidy\nconsole.log(1);\n');
    expect(ids).toEqual(expect.arrayContaining(['no-console', 'rivr/todo-needs-issue']));
  });
});
