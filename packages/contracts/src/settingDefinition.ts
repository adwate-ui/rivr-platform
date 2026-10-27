/** The shape of a setting key, which settings.ts and rewardSettings.ts both declare keys with. */
import type { z } from 'zod';

/** What a setting applies to: the whole venue, or one table type, stake, tier or role. */
export const SETTING_SCOPES = ['venue', 'table_type', 'stake', 'tier', 'role'] as const;
export type SettingScope = (typeof SETTING_SCOPES)[number];

/** One setting key: its scope and the schema its value must satisfy. */
export interface SettingDefinition<Schema extends z.ZodType = z.ZodType> {
  readonly key: string;
  readonly description: string;
  readonly scope: SettingScope;
  readonly value: Schema;
}
