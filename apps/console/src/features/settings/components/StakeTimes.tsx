import type { SettingSubjectRules } from '@rivr/db';
import { Sheet, Stack, StakeValues, type StakeValueMap } from '@rivr/ui';
import { useState } from 'react';
import { ChangeFields, ChangeFooter, useChangeForm, type DraftsRead } from './ChangeForm.tsx';
import { firstSubject, offeredSubjects, SettingHistory, sheetWords, SubjectChoice, type SettingSheetProps } from './SettingHistory.tsx';
import { settingName } from './settingsCopy.ts';

/** A stake's call time in force, in minutes; null for a stake with none. */
function minutesOf(rules: SettingSubjectRules): number | null {
  const minutes = rules.inForce?.value['minutes'];
  return typeof minutes === 'number' ? minutes : null;
}

/**
 * Call time for every stake at once (redesign RD-19): one typed value for each stake the club has today, in minutes as
 * the stake's own form in Tables setup types it, then when and why. Save sends a change for each stake whose value differs
 * from the one in force; a stake left blank keeps what it has, since a stake in use needs a call time. Under the form, the
 * history of the stake chosen there.
 */
export function StakeTimesSheet({ venueId, setting, tiers, onClose }: SettingSheetProps) {
  const stakes = offeredSubjects(setting).map((rules) => ({ id: rules.subject, name: rules.label, value: minutesOf(rules) }));
  const [values, setValues] = useState<StakeValueMap | null>(() => Object.fromEntries(stakes.map((stake) => [stake.id, stake.value])));
  const [subject, setSubject] = useState(() => firstSubject(setting));
  const read = (): DraftsRead => {
    // A value outside the range is said under its own field.
    if (values === null) return { invalid: [] };
    const changes = stakes.flatMap((stake) => {
      const typed = values[stake.id] ?? null;
      return typed === null || typed === stake.value ? [] : [{ subject: stake.id, value: { minutes: typed } }];
    });
    return changes.length === 0 ? { unchanged: true } : { changes };
  };
  const change = useChangeForm({
    venueId, settingKey: setting.key, drafts: {}, read, onCancel: onClose,
    toCome: (of) => setting.subjects.find((one) => one.subject === of)?.scheduled ?? [],
  });
  return (
    <Sheet place="console" isOpen onClose={onClose} {...sheetWords(setting)} footer={<ChangeFooter change={change} />}>
      <Stack gap={6}>
        <ChangeFields change={change}>
          <StakeValues label={settingName(setting.key)} stakes={stakes} unit="minutes" min={1} max={1440}
            onChange={(next) => { change.onEdit(); setValues(next); }} />
        </ChangeFields>
        <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />
        <SettingHistory venueId={venueId} setting={setting} tiers={tiers} subject={subject} canWithdraw />
      </Stack>
    </Sheet>
  );
}
