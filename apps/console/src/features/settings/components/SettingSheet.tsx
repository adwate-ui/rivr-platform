import { Sheet, Stack } from '@rivr/ui';
import { useState } from 'react';
import { ChangeFields, ChangeFooter, startOf, useChangeForm } from './ChangeForm.tsx';
import { SettingFields } from './SettingFields.tsx';
import { firstSubject, SettingHistory, sheetWords, SubjectChoice, type SettingSheetProps } from './SettingHistory.tsx';
import { defaultOf } from './settingsCopy.ts';
import { StakeTimesSheet } from './StakeTimes.tsx';
import { draftsFrom, readValue } from './valueDraft.ts';

/** What a setting was, is and will be, for staff who may not change it: no form, and nothing to withdraw. */
function HistorySheet({ venueId, setting, tiers, onClose }: SettingSheetProps) {
  const [subject, setSubject] = useState(() => firstSubject(setting));
  return (
    <Sheet place="console" isOpen onClose={onClose} {...sheetWords(setting)}>
      <Stack gap={6}>
        {setting.scope === 'venue' ? null : <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />}
        <SettingHistory venueId={venueId} setting={setting} tiers={tiers} subject={subject} canWithdraw={false} />
      </Stack>
    </Sheet>
  );
}

/**
 * A new value for one setting: for a scoped one, what it applies to first; then its fields, built from the key's schema
 * and filled with the value in force, or with what the club runs on while nothing is set; when and why; then the value
 * now, the changes to come and before. Cancel and Save are in the panel's foot.
 */
function ValueSheet({ venueId, setting, tiers, onClose }: SettingSheetProps) {
  const [subject, setSubject] = useState(() => firstSubject(setting));
  const draftsFor = (of: string) => draftsFrom(setting.fields, setting.subjects.find((one) => one.subject === of)?.inForce?.value ?? defaultOf(setting.key) ?? null);
  const change = useChangeForm({
    venueId, settingKey: setting.key, drafts: draftsFor(subject), onCancel: onClose,
    toCome: (of) => setting.subjects.find((one) => one.subject === of)?.scheduled ?? [],
    read: (drafts) => {
      const read = readValue(setting.key, setting.fields, drafts);
      return 'value' in read ? { changes: [{ subject, value: read.value }] } : read;
    },
  });
  const choose = (next: string) => {
    setSubject(next);
    change.form.reset(startOf(draftsFor(next)));
    change.onEdit();
  };
  // A scoped setting needs its subject first: the database refuses one without.
  const canChange = setting.scope === 'venue' || subject !== '';
  return (
    <Sheet place="console" isOpen onClose={onClose} {...sheetWords(setting)} footer={canChange ? <ChangeFooter change={change} /> : undefined}>
      <Stack gap={6}>
        {setting.scope === 'venue' ? null : <SubjectChoice setting={setting} subject={subject} onChange={choose} />}
        {canChange ? (
          <ChangeFields change={change}>
            <SettingFields key={subject} form={change.form} setting={setting} tiers={tiers} onEdit={change.onEdit} />
          </ChangeFields>
        ) : null}
        <SettingHistory venueId={venueId} setting={setting} tiers={tiers} subject={subject} canWithdraw />
      </Stack>
    </Sheet>
  );
}

/**
 * The panel a setting's row opens on the right (redesign RD-18): its change, for staff who may change it, call time for
 * every stake at once (RD-19); for anyone else, its history to read.
 */
export function SettingSheet({ isReadOnly, ...sheet }: SettingSheetProps & { isReadOnly: boolean }) {
  if (isReadOnly) return <HistorySheet {...sheet} />;
  return sheet.setting.key === 'call_time.minutes' ? <StakeTimesSheet {...sheet} /> : <ValueSheet {...sheet} />;
}
