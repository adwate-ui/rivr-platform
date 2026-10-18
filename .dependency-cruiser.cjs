/**
 * Architecture rules from docs/engineering/stack.md, enforced on every import.
 * Tests may import test tooling and @rivr/testing; the layering applies to source files.
 */
const NOT_TESTS = '\\.(test|spec|stories)\\.(ts|tsx)$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Import cycles hide the order things load in. Move the shared part down a layer.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-never-import-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'apps-never-import-other-apps',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'domain-imports-only-contracts',
      severity: 'error',
      comment: 'Business rules are pure TypeScript over contracts. No React, no Supabase, no vendor SDK.',
      from: { path: '^packages/domain/src/', pathNot: NOT_TESTS },
      to: { pathNot: '^packages/(domain|contracts)/src/' },
    },
    {
      name: 'testing-imports-only-contracts',
      severity: 'error',
      comment: "domain's tests import @rivr/testing, so testing importing domain would be a cycle (docs/decisions/0013).",
      from: { path: '^packages/testing/src/' },
      to: { path: '^packages/', pathNot: '^packages/(testing|contracts)/' },
    },
    {
      name: 'ui-imports-only-tokens-and-i18n',
      severity: 'error',
      from: { path: '^packages/ui/src/', pathNot: NOT_TESTS },
      to: { path: '^packages/', pathNot: '^packages/(ui|tokens|i18n)/' },
    },
    {
      name: 'only-db-talks-to-supabase',
      severity: 'error',
      from: { path: '^(apps|packages)/', pathNot: '^packages/db/' },
      to: { path: 'node_modules/@supabase/' },
    },
    {
      name: 'features-never-import-routes',
      severity: 'error',
      comment: 'Layering inside an app: routes -> features -> packages.',
      from: { path: '^apps/[^/]+/src/features/' },
      to: { path: '^apps/[^/]+/src/routes/' },
    },
    {
      name: 'no-feature-to-feature',
      severity: 'error',
      comment: 'A feature never imports another feature; shared logic moves to a package.',
      from: { path: '^apps/([^/]+)/src/features/([^/]+)/' },
      to: { path: '^apps/$1/src/features/', pathNot: '^apps/$1/src/features/$2/' },
    },
    {
      name: 'features-only-through-index',
      severity: 'error',
      comment: "A feature's index.ts is its only import surface.",
      from: { path: '^apps/([^/]+)/src/', pathNot: '^apps/$1/src/features/' },
      to: { path: '^apps/$1/src/features/[^/]+/', pathNot: '^apps/$1/src/features/[^/]+/index\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|dist|storybook-static|android|generated|\\.astro)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
    },
  },
};
