import { STAFF_ROLES } from '@rivr/contracts/roles';
import { useSettingActions, type SettingEntry, type SettingFailure, type SettingSubjectRules, type VenueSetting } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { settingFailureText, valueText } from './settingsCopy.ts';
import { ValueForm } from './ValueForm.tsx';

type Subject = { readonly subject: string; readonly label: string };

/** A role's name as the Staff screen gives it; a table type or tier by its own name; a stake as written. */
function subjectLabel(setting: VenueSetting, rules: SettingSubjectRules): string {
  const role = setting.scope === 'role' ? STAFF_ROLES.find((one) => one === rules.subject) : undefined;
  return role === undefined ? rules.label : t(`console.staff.roles.${role}`);
}

const since = (entry: SettingEntry) =>
  entry.effectiveFrom === null ? t('console.settings.sinceOpening') : t('console.settings.since', { date: formatDayTime(new Date(entry.effectiveFrom)) });

/** What the setting is for this subject: in force now, the changes to come (each can be withdrawn), and before. */
function SubjectRules({ venueId, rules, describe }: { venueId: string; rules: SettingSubjectRules; describe: (entry: SettingEntry) => string }) {
  const { withdraw } = useSettingActions(venueId);
  const [outcome, setOutcome] = useState<SettingFailure | 'withdrawn' | null>(null);
  const take = async (entry: SettingEntry) => {
    const done = await withdraw.mutateAsync(entry.settingId);
    setOutcome(done.ok ? 'withdrawn' : done.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('console.settings.inForce')}</Heading>
      {rules.inForce === null ? <Text tone="muted">{t('console.settings.notSet')}</Text>
        : <Text>{t('console.settings.entry', { value: describe(rules.inForce), since: since(rules.inForce) })}</Text>}
      <Heading level={3}>{t('console.settings.toCome')}</Heading>
      {rules.scheduled.length === 0 ? <Text tone="muted">{t('console.settings.noneToCome')}</Text> : rules.scheduled.map((entry) => {
        const from = entry.effectiveFrom === null ? '' : formatDayTime(new Date(entry.effectiveFrom));
        return (
          <Inline key={entry.settingId} gap={4} wrap>
            <Text>{t('console.settings.fromEntry', { date: from, value: describe(entry) })}</Text>
            <Button variant="text" isLoading={withdraw.isPending} onClick={() => void take(entry)}>{t('console.settings.withdrawFrom', { date: from })}</Button>
          </Inline>
        );
      })}
      {outcome === 'withdrawn' ? <Text variant="small">{t('console.settings.withdrawn')}</Text> : null}
      {outcome !== null && outcome !== 'withdrawn' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
      <Heading level={3}>{t('console.settings.before')}</Heading>
      {rules.history.length === 0 ? <Text tone="muted">{t('console.settings.noneBefore')}</Text>
        : rules.history.map((entry) => <Text key={entry.settingId} tone="muted">{t('console.settings.entry', { value: describe(entry), since: since(entry) })}</Text>)}
    </Stack>
  );
}

/** One setting opened from the list: what it is for each subject, and a new value for one. */
export function SettingPanel({ venueId, setting, tiers, onClose }: { venueId: string; setting: VenueSetting; tiers: readonly Subject[]; onClose: () => void }) {
  const [subject, setSubject] = useState(setting.subjects[0]?.subject ?? '');
  const rules = setting.subjects.find((one) => one.subject === subject);
  const tierName = (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id;
  const describe = (entry: SettingEntry) => valueText(setting.fields, entry.value, tierName);
  return (
    <Stack gap={6}>
      <Inline gap={4} align="center">
        <Heading level={2}>{setting.key}</Heading>
        <Button variant="text" onClick={onClose}>{t('console.settings.close')}</Button>
      </Inline>
      <Text tone="muted">{setting.description}</Text>
      {setting.scope === 'venue' ? null : (
        <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />
      )}
      {rules === undefined ? null : <SubjectRules venueId={venueId} rules={rules} describe={describe} />}
      {/* A scoped setting needs its subject first: the database refuses one without. */}
      {setting.scope !== 'venue' && subject === '' ? null : (
        <ValueForm key={`${setting.key}:${subject}`} venueId={venueId} setting={setting} subject={subject} inForce={rules?.inForce?.value ?? null} tiers={tiers} />
      )}
    </Stack>
  );
}

/** What a scoped setting is given for: one of the scope's subjects, or a stake as typed. */
function SubjectChoice({ setting, subject, onChange }: { setting: VenueSetting; subject: string; onChange: (subject: string) => void }) {
  const scope = setting.scope === 'venue' ? 'table_type' : setting.scope;
  const label = t(`console.settings.subjects.${scope}`);
  const options = setting.subjects.map((rules) => ({ value: rules.subject, label: subjectLabel(setting, rules) }));
  return (
    <Stack gap={3}>
      {options.length > 0 ? <ChoiceChips label={label} mode="one" selected={subject === '' ? [] : [subject]} options={options} onChange={(chosen) => onChange(chosen[0] ?? '')} /> : null}
      {setting.scope === 'stake' ? <Input label={label} hint={t('console.settings.stakeHint')} value={subject} onChange={(event) => onChange(event.target.value.trim())} /> : null}
      {subject === '' ? <ErrorMessage>{t('console.settings.chooseSubject')}</ErrorMessage> : null}
    </Stack>
  );
}
