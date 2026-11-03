import type { SettingField, VenueSetting } from '@rivr/db';

/** One bonus chip is 100 paise, as the promotions' bonus chips are (decision 0472). */
export const PAISE_PER_BONUS_CHIP = 100;

/**
 * The settings held in paise that the console shows and takes in bonus chips, never in rupees (owner, 3 Nov; decision
 * 0284): the spin wheel's monthly budget, so the Spin wheel's link to it lands on a value staff can read and change.
 * The stored value stays in paise.
 */
const IN_BONUS_CHIPS: Readonly<Record<string, readonly string[]>> = { 'spin.budget': ['monthly_paise'] };

/** Whether a field is shown in bonus chips: no ₹, its value and limits divided into chips. */
export const isBonusChips = (field: SettingField): boolean => 'inBonusChips' in field && field.inBonusChips === true;

/** The setting with its money fields marked to show in bonus chips, where the console shows them so; else as it is. */
export function shownInBonusChips(setting: VenueSetting): VenueSetting {
  const names = IN_BONUS_CHIPS[setting.key];
  if (names === undefined) return setting;
  const fields = setting.fields.map((field): SettingField => (field.kind === 'integer' && names.includes(field.name)
    ? Object.assign({}, field, { isMoney: false, isChips: false, inBonusChips: true })
    : field));
  return { ...setting, fields };
}
