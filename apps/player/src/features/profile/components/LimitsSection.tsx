import { SESSION_REMINDERS, useRestrictionActions, type Restrictions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, Heading, Stack, Text } from '@rivr/ui';

const NONE = 'none';

/** The session reminder (#56): after how many hours seated the app reminds the member, or never. */
export function LimitsSection({ restrictions }: { restrictions: Restrictions }) {
  const { setReminder } = useRestrictionActions();
  const options = [
    { value: NONE, label: t('player.profile.reminderNone') },
    ...SESSION_REMINDERS.map((hours) => ({ value: String(hours), label: t('player.profile.reminderHours', { hours }) })),
  ];
  const selected = [restrictions.sessionReminder === null ? NONE : String(restrictions.sessionReminder)];
  // One is always chosen: pressing the chosen one again keeps it.
  const choose = ([value]: string[]) => {
    if (value === undefined) return;
    setReminder.mutate(SESSION_REMINDERS.find((hours) => String(hours) === value) ?? null);
  };
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.limits')}</Heading>
      <ChoiceChips label={t('player.profile.sessionReminder')} options={options} selected={selected} mode="one"
        isDisabled={setReminder.isPending} onChange={choose} />
      {setReminder.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
    </Stack>
  );
}
