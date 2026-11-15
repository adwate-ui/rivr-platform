import type { SettingValue, VenueSetting } from '@rivr/db';
import { Stack } from '@rivr/ui';
import { Controller } from 'react-hook-form';
import { ChangeForm, type ChangeFormApi } from './ChangeForm.tsx';
import { FieldInput } from './FieldInput.tsx';
import { draftsFrom, readValue } from './valueDraft.ts';

type Tiers = readonly { readonly subject: string; readonly label: string }[];

const draftPath = (name: string) => `drafts.${name}` as const;

/** Each field of the value, as its schema gives it. */
function SettingFields({ form, setting, tiers, onEdit }: { form: ChangeFormApi; setting: VenueSetting; tiers: Tiers; onEdit: () => void }) {
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

interface ValueFormProps {
  venueId: string;
  setting: VenueSetting;
  /** What it is for: a table type's code, a tier's id, a stake or a role; empty for the venue. */
  subject: string;
  inForce: SettingValue | null;
  tiers: Tiers;
}

/**
 * A new value for one setting and subject, its fields built from the key's schema and filled with the value in force.
 * The value is checked by the key's schema before it is sent, and by the database again.
 */
export function ValueForm({ venueId, setting, subject, inForce, tiers }: ValueFormProps) {
  return (
    <ChangeForm venueId={venueId} settingKey={setting.key} drafts={draftsFrom(setting.fields, inForce)}
      read={(drafts) => {
        const read = readValue(setting.key, setting.fields, drafts);
        return 'value' in read ? { changes: [{ subject, value: read.value }] } : read;
      }}>
      {(form, onEdit) => <SettingFields form={form} setting={setting} tiers={tiers} onEdit={onEdit} />}
    </ChangeForm>
  );
}
