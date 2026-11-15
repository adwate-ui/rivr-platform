import type { VenueSetting } from '@rivr/db';
import { Stack } from '@rivr/ui';
import { Controller } from 'react-hook-form';
import type { ChangeFormApi } from './ChangeForm.tsx';
import { FieldInput } from './FieldInput.tsx';
import type { Tiers } from './SettingHistory.tsx';

const draftPath = (name: string) => `drafts.${name}` as const;

/** Each field of a setting's value, as its schema gives it; `onEdit` clears what the last save said. */
export function SettingFields({ form, setting, tiers, onEdit }: { form: ChangeFormApi; setting: VenueSetting; tiers: Tiers; onEdit: () => void }) {
  const invalid = form.formState.errors.drafts ?? {};
  return (
    <Stack gap={4}>
      {setting.fields.map((field) => (
        <Controller key={field.name} control={form.control} name={draftPath(field.name)} render={({ field: draft }) => (
          <FieldInput settingKey={setting.key} field={field} draft={draft.value} isInvalid={invalid[field.name] !== undefined} tiers={tiers}
            onChange={(next) => { onEdit(); draft.onChange(next); }} />
        )} />
      ))}
    </Stack>
  );
}
