import { STAFF_ROLES } from '@rivr/contracts/roles';
import { useSettingActions, type SettingEntry, type SettingFailure, type SettingSubjectRules, type VenueSetting } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { isSuperAdminOnly, settingFailureText, settingHelp, settingName, valueText } from './settingsCopy.ts';
import { ValueForm } from './ValueForm.tsx';

type Subject = { readonly subject: string; readonly label: string };

/** A role's name as the Staff screen gives it; a table type or tier by its own name; a stake as written. */
function subjectLabel(setting: VenueSetting, rules: SettingSubjectRules): string {
  const role = setting.scope === 'role' ? STAFF_ROLES.find((one) => one === rules.subject) : undefined;
  return role === undefined ? rules.label : t(`console.staff.roles.${role}`);
}

/** When a value began, who set it and why: "Since 20 Oct, 18:00 · by Vikram Rao · Busier nights" (#604). */
function detailOf(entry: SettingEntry): string {
  const since = entry.effectiveFrom === null ? t('console.settings.sinceOpening') : t('console.settings.since', { date: formatDayTime(new Date(entry.effectiveFrom)) });
  const by = entry.createdBy === null ? null : t('console.settings.by', { name: entry.createdBy });
  return [since, by, entry.reason].filter((part) => part !== null && part !== '').join(t('console.settings.fieldSeparator'));
}

interface SubjectRulesProps {
  venueId: string;
  rules: SettingSubjectRules;
  describe: (entry: SettingEntry) => string;
  /** False for a super admin's setting seen by an admin: the changes to come stay. */
  canWithdraw: boolean;
}

/** What the setting is for this subject: in force now, the changes to come (each can be withdrawn), and before. */
function SubjectRules({ venueId, rules, describe, canWithdraw }: SubjectRulesProps) {
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
        : <Text>{t('console.settings.entry', { value: describe(rules.inForce), since: detailOf(rules.inForce) })}</Text>}
      <Heading level={3}>{t('console.settings.toCome')}</Heading>
      {rules.scheduled.length === 0 ? <Text tone="muted">{t('console.settings.noneToCome')}</Text> : rules.scheduled.map((entry) => {
        const from = entry.effectiveFrom === null ? '' : formatDayTime(new Date(entry.effectiveFrom));
        return (
          <Inline key={entry.settingId} gap={4} wrap>
            <Text>{t('console.settings.fromEntry', { date: from, value: describe(entry) })}</Text>
            {canWithdraw ? <Button variant="text" isLoading={withdraw.isPending} onClick={() => void take(entry)}>{t('console.settings.withdrawFrom', { date: from })}</Button> : null}
          </Inline>
        );
      })}
      {outcome === 'withdrawn' ? <Text variant="small">{t('console.settings.withdrawn')}</Text> : null}
      {outcome !== null && outcome !== 'withdrawn' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
      <Heading level={3}>{t('console.settings.before')}</Heading>
      {rules.history.length === 0 ? <Text tone="muted">{t('console.settings.noneBefore')}</Text>
        : rules.history.map((entry) => <Text key={entry.settingId} tone="muted">{t('console.settings.entry', { value: describe(entry), since: detailOf(entry) })}</Text>)}
    </Stack>
  );
}

interface SettingPanelProps {
  venueId: string;
  setting: VenueSetting;
  tiers: readonly Subject[];
  /** A super admin, who changes the settings only a super admin may. */
  isSuperAdmin: boolean;
}

/** The setting's name, what it does, and whether only a super admin changes it. */
function SettingHeading({ setting }: { setting: VenueSetting }) {
  return (
    <Stack gap={2}>
      <Heading level={2}>{settingName(setting.key)}</Heading>
      <Text tone="muted">{settingHelp(setting.key, setting.description)}</Text>
      {isSuperAdminOnly(setting.key) ? <Text variant="small">{t('console.settings.superAdminNote')}</Text> : null}
    </Stack>
  );
}

/** A value as one line, with a tier by its name. */
function describerFor(setting: VenueSetting, tiers: readonly Subject[]): (entry: SettingEntry) => string {
  const tierName = (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id;
  return (entry) => valueText(setting.key, setting.fields, entry.value, tierName);
}

const firstSubject = (setting: VenueSetting) => setting.subjects[0]?.subject ?? '';
const inForceOf = (rules: SettingSubjectRules | undefined) => rules?.inForce?.value ?? null;

/**
 * One setting opened from its area (#604): its name and what it does, then for each subject the value now, the changes
 * to come and before, each with who set it and why, and a new value. A super admin's setting is read-only for others.
 */
export function SettingPanel({ venueId, setting, tiers, isSuperAdmin }: SettingPanelProps) {
  const [subject, setSubject] = useState(() => firstSubject(setting));
  const rules = setting.subjects.find((one) => one.subject === subject);
  const describe = describerFor(setting, tiers);
  const isLocked = isSuperAdminOnly(setting.key) && !isSuperAdmin;
  // A scoped setting needs its subject first: the database refuses one without.
  const canChange = !isLocked && (setting.scope === 'venue' || subject !== '');
  return (
    <Stack gap={6}>
      <SettingHeading setting={setting} />
      {setting.scope === 'venue' ? null : <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />}
      {rules === undefined ? null : <SubjectRules venueId={venueId} rules={rules} describe={describe} canWithdraw={!isLocked} />}
      {canChange ? <ValueForm key={`${setting.key}:${subject}`} venueId={venueId} setting={setting} subject={subject} inForce={inForceOf(rules)} tiers={tiers} /> : null}
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
