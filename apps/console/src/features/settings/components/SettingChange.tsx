import type { VenueSetting } from '@rivr/db';
import { Stack } from '@rivr/ui';
import { useState } from 'react';
import { firstSubject, inForceOf, SubjectChoice } from './SettingPanel.tsx';
import { ValueForm } from './ValueForm.tsx';

interface SettingChangeProps {
  venueId: string;
  setting: VenueSetting;
  tiers: readonly { readonly subject: string; readonly label: string }[];
}

/**
 * A setting changed in its own row of the list (console v3): for a scoped one, what it applies to first; then the new
 * value, from now or a later day, never backwards, and why. Its history and the changes to come are in its panel.
 */
export function SettingChange({ venueId, setting, tiers }: SettingChangeProps) {
  const [subject, setSubject] = useState(() => firstSubject(setting));
  const rules = setting.subjects.find((one) => one.subject === subject);
  // A scoped setting needs its subject first: the database refuses one without.
  const canChange = setting.scope === 'venue' || subject !== '';
  return (
    <Stack gap={4}>
      {setting.scope === 'venue' ? null : <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />}
      {canChange ? (
        <ValueForm key={`${setting.key}:${subject}`} look="row" venueId={venueId} setting={setting} subject={subject} inForce={inForceOf(rules)} tiers={tiers} />
      ) : null}
    </Stack>
  );
}
