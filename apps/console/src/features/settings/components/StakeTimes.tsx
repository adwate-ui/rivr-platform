import type { VenueSetting } from '@rivr/db';
import { StakeValues, type StakeValueMap } from '@rivr/ui';
import { useState } from 'react';
import { ChangeForm, type DraftsRead } from './ChangeForm.tsx';
import { settingName } from './settingsCopy.ts';

/** A stake's call time in force, in minutes; null for a stake with none. */
function minutesOf(value: VenueSetting['subjects'][number]['inForce']): number | null {
  const minutes = value?.value['minutes'];
  return typeof minutes === 'number' ? minutes : null;
}

/**
 * Call time for every stake at once (redesign RD-19): one typed value per stake, in minutes as the stake's own form in
 * Tables setup types it, then when and why. Save sends a change for each stake whose value differs from the one in force;
 * a stake left blank keeps what it has, since a stake in use needs a call time.
 */
export function StakeTimesForm({ venueId, setting }: { venueId: string; setting: VenueSetting }) {
  const stakes = setting.subjects.map((rules) => ({ id: rules.subject, name: rules.label, value: minutesOf(rules.inForce) }));
  const [values, setValues] = useState<StakeValueMap | null>(() => Object.fromEntries(stakes.map((stake) => [stake.id, stake.value])));
  const read = (): DraftsRead => {
    // A value outside the range is said under its own field.
    if (values === null) return { invalid: [] };
    const changes = stakes.flatMap((stake) => {
      const typed = values[stake.id] ?? null;
      return typed === null || typed === stake.value ? [] : [{ subject: stake.id, value: { minutes: typed } }];
    });
    return changes.length === 0 ? { unchanged: true } : { changes };
  };
  return (
    <ChangeForm venueId={venueId} settingKey={setting.key} drafts={{}} read={read}>
      {(_form, onEdit) => (
        <StakeValues label={settingName(setting.key)} stakes={stakes} unit="minutes" min={1} max={1440}
          onChange={(next) => { onEdit(); setValues(next); }} />
      )}
    </ChangeForm>
  );
}
