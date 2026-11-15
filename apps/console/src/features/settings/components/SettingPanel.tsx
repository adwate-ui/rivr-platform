import { STAFF_ROLES } from '@rivr/contracts/roles';
import { useSettingActions, type SettingEntry, type SettingFailure, type SettingSubjectRules, type SettingValue, type VenueSetting } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { defaultOf, settingFailureText, valueText } from './settingsCopy.ts';
import { StakeTimesForm } from './StakeTimes.tsx';
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
  describe: (value: SettingValue) => string;
  /** What shows while nothing is set: the default the club runs on, or that there is none. */
  unsetText: string;
}

/** What the setting is for this subject: in force now, the changes to come (each can be withdrawn), and before. */
function SubjectRules({ venueId, rules, describe, unsetText }: SubjectRulesProps) {
  const { withdraw } = useSettingActions(venueId);
  const [outcome, setOutcome] = useState<SettingFailure | 'withdrawn' | null>(null);
  const take = async (entry: SettingEntry) => {
    const done = await withdraw.mutateAsync(entry.settingId);
    setOutcome(done.ok ? 'withdrawn' : done.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('console.settings.inForce')}</Heading>
      {rules.inForce === null ? <Text tone="muted">{unsetText}</Text>
        : <Text>{t('console.settings.entry', { value: describe(rules.inForce.value), since: detailOf(rules.inForce) })}</Text>}
      <Heading level={3}>{t('console.settings.toCome')}</Heading>
      {rules.scheduled.length === 0 ? <Text tone="muted">{t('console.settings.noneToCome')}</Text> : rules.scheduled.map((entry) => {
        const from = entry.effectiveFrom === null ? '' : formatDayTime(new Date(entry.effectiveFrom));
        return (
          <Inline key={entry.settingId} gap={4} wrap>
            <Text>{t('console.settings.fromEntry', { date: from, value: describe(entry.value) })}</Text>
            <Button variant="text" isLoading={withdraw.isPending} onClick={() => void take(entry)}>{t('console.settings.withdrawFrom', { date: from })}</Button>
          </Inline>
        );
      })}
      {outcome === 'withdrawn' ? <Text variant="small">{t('console.settings.withdrawn')}</Text> : null}
      {outcome !== null && outcome !== 'withdrawn' ? <ErrorMessage>{settingFailureText(outcome)}</ErrorMessage> : null}
      <Heading level={3}>{t('console.settings.before')}</Heading>
      {rules.history.length === 0 ? <Text tone="muted">{t('console.settings.noneBefore')}</Text>
        : rules.history.map((entry) => <Text key={entry.settingId} tone="muted">{t('console.settings.entry', { value: describe(entry.value), since: detailOf(entry) })}</Text>)}
    </Stack>
  );
}

interface SettingPanelProps {
  venueId: string;
  setting: VenueSetting;
  tiers: readonly Subject[];
}

/** A value as one line, with a tier by its name. */
function describerFor(setting: VenueSetting, tiers: readonly Subject[]): (value: SettingValue) => string {
  const tierName = (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id;
  return (value) => valueText(setting.key, setting.fields, value, tierName);
}

export const firstSubject = (setting: VenueSetting) => setting.subjects[0]?.subject ?? '';
export const inForceOf = (rules: SettingSubjectRules | undefined) => rules?.inForce?.value ?? null;

/**
 * One setting's change, in the panel its Change opens (redesign RD-18): for a scoped one, what it applies to first; then
 * the new value, and the value now, the changes to come and before, each with who set it and why. Call time is typed for
 * every stake at once (RD-19), and the stake chosen under it is the one whose history shows.
 */
export function SettingPanel({ venueId, setting, tiers }: SettingPanelProps) {
  const [subject, setSubject] = useState(() => firstSubject(setting));
  const rules = setting.subjects.find((one) => one.subject === subject);
  const describe = describerFor(setting, tiers);
  const fallback = defaultOf(setting.key);
  const unsetText = fallback === undefined ? t('console.settings.notSet') : t('console.settings.byDefault', { value: describe(fallback) });
  // A scoped setting needs its subject first: the database refuses one without.
  const canChange = setting.scope === 'venue' || subject !== '';
  const isPerStake = setting.key === 'call_time.minutes';
  return (
    <Stack gap={6}>
      {isPerStake ? <StakeTimesForm venueId={venueId} setting={setting} /> : null}
      {setting.scope === 'venue' ? null : <SubjectChoice setting={setting} subject={subject} onChange={setSubject} />}
      {canChange && !isPerStake ? <ValueForm key={`${setting.key}:${subject}`} venueId={venueId} setting={setting} subject={subject} inForce={inForceOf(rules)} tiers={tiers} /> : null}
      {rules === undefined ? null : <SubjectRules venueId={venueId} rules={rules} describe={describe} unsetText={unsetText} />}
    </Stack>
  );
}

/** What a scoped setting is given for: one of the scope's subjects, or a stake as typed. */
export function SubjectChoice({ setting, subject, onChange }: { setting: VenueSetting; subject: string; onChange: (subject: string) => void }) {
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
