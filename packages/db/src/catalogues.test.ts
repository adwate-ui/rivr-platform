// @vitest-environment node
/**
 * The feature catalogue, role matrix and setting keys are declared twice: in code
 * (@rivr/contracts) and in the migrations that load them into the database. These tests read the
 * migrations and fail when the two disagree, so a lane that adds a key in one place and forgets
 * the other finds out before review.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FEATURES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SETTINGS,
  STAFF_ROLES,
  settingValueJsonSchema,
} from '@rivr/contracts';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(MIGRATIONS, file), 'utf8'))
  .join('\n');

function featuresInMigrations(): Map<string, boolean> {
  const blocks = sql.match(/insert into public\.feature \([^)]*\) values[\s\S]*?;/g) ?? [];
  const rows = blocks.flatMap((block) => [...block.matchAll(/\(\s*'([a-z_]+\.[a-z0-9_.-]+)',[\s\S]*?,\s*(true|false)\)/g)]);
  return new Map(rows.map(([, key, gateable]) => [key ?? '', gateable === 'true']));
}

function permissionsInMigrations(): Map<string, string[]> {
  const blocks = [...sql.matchAll(/select '([a-z_]+)', permission\s+from unnest\(array\[([\s\S]*?)\]\)/g)];
  return new Map(blocks.map(([, role, list]) => [role ?? '', [...(list ?? '').matchAll(/'([a-z_.]+)'/g)].map(([, p]) => p ?? '').sort()]));
}

function settingKeysInMigrations(): Map<string, { scope: string; schema: unknown }> {
  const rows = [...sql.matchAll(/\('([a-z_]+\.[a-z_]+)',\s*'(?:[^']|'')*',\s*'([a-z_]+)',\s*'(\{[\s\S]*?\})'\)/g)];
  return new Map(rows.map(([, key, scope, schema]) => [key ?? '', { scope: scope ?? '', schema: JSON.parse(schema ?? 'null') }]));
}

describe('the feature catalogue', () => {
  it('has the same keys in code and in the database', () => {
    expect([...featuresInMigrations().keys()].sort()).toEqual(FEATURES.map((feature) => feature.key).sort());
  });

  it('agrees on which features are gateable', () => {
    const inDatabase = featuresInMigrations();
    for (const feature of FEATURES) expect([feature.key, inDatabase.get(feature.key)]).toEqual([feature.key, feature.isGateable]);
  });
});

describe('the role matrix', () => {
  it('has the same roles in code and in the staff_role enum', () => {
    const enumValues = sql.match(/create type public\.staff_role as enum \(([^)]*)\)/)?.[1] ?? '';
    expect([...enumValues.matchAll(/'([a-z_]+)'/g)].map(([, role]) => role)).toEqual([...STAFF_ROLES]);
  });

  it('gives each role the same permissions in code and in the database', () => {
    const inDatabase = permissionsInMigrations();
    for (const role of STAFF_ROLES) {
      const expected = role === 'super_admin' ? [...PERMISSIONS] : [...ROLE_PERMISSIONS[role]];
      expect([role, inDatabase.get(role)]).toEqual([role, expected.sort()]);
    }
  });
});

describe('the setting keys', () => {
  it('have the same keys, scopes and value schemas in code and in the database', () => {
    const inDatabase = settingKeysInMigrations();
    expect([...inDatabase.keys()].sort()).toEqual(SETTINGS.map((setting) => setting.key).sort());
    for (const setting of SETTINGS) {
      expect(inDatabase.get(setting.key)).toEqual({ scope: setting.scope, schema: settingValueJsonSchema(setting) });
    }
  });
});
