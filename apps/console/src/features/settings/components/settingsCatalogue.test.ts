import { SETTINGS, settingValueJsonSchema } from '@rivr/contracts/settings';
import { settingCopy, settingKeys } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { areaOf, RULE_AREAS } from './areas.ts';

/** The schema's fields and, for a choice or a list, its options. */
function fieldsOf(schema: Record<string, unknown>): [string, readonly string[]][] {
  const properties = schema['properties'];
  if (typeof properties !== 'object' || properties === null) return [];
  return Object.entries(properties).map(([name, property]: [string, unknown]) => {
    const own = typeof property === 'object' && property !== null ? Reflect.get(property, 'enum') : undefined;
    const items = typeof property === 'object' && property !== null ? Reflect.get(property, 'items') : undefined;
    const listed = typeof items === 'object' && items !== null ? Reflect.get(items, 'enum') : undefined;
    const options = [own, listed].find((value): value is string[] => Array.isArray(value)) ?? [];
    return [name, options];
  });
}

describe('every setting the contracts declare, as the Settings screen shows it', () => {
  it('has a name, a line of help, an area, a label for every field and a word for every option', () => {
    for (const definition of SETTINGS) {
      const copy = settingCopy(definition.key);
      expect(copy?.name, definition.key).toBeTruthy();
      expect(copy?.help, definition.key).toBeTruthy();
      expect(RULE_AREAS, definition.key).toContain(areaOf(definition.key));
      for (const [field, options] of fieldsOf(settingValueJsonSchema(definition))) {
        expect(copy?.fields[field], `${definition.key} ${field}`).toBeTruthy();
        // A tier's options are the venue's own tiers, named by the venue.
        for (const option of options) expect(copy?.options?.[option], `${definition.key} ${field} ${option}`).toBeTruthy();
      }
    }
  });

  it('gives no words to a key the contracts no longer declare', () => {
    expect(Object.keys(settingKeys).sort()).toEqual(SETTINGS.map((definition) => definition.key).sort());
    expect(settingCopy('no.such_key')).toBeUndefined();
  });
});
