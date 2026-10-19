import { BREAK_DAYS, useRestrictionActions, type BreakDays, type Restrictions } from '@rivr/db';
import { formatDayTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceSheet, Heading, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

const BREAK_LABEL: Readonly<Record<BreakDays, MessageKey>> = {
  1: 'player.profile.break1',
  7: 'player.profile.break7',
  30: 'player.profile.break30',
};

const DAY_MS = 86_400_000;

/**
 * Self-exclusion (#56), as in the prototype: Take a break opens a sheet of 24 hours, 7 days or 30
 * days, each saying when it would end. Once taken, the section says when the break ends; it cannot be
 * shortened, so there is nothing to undo.
 */
export function BreakSection({ restrictions }: { restrictions: Restrictions }) {
  const { takeBreak } = useRestrictionActions();
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const choices = BREAK_DAYS.map((days) => ({
    value: String(days),
    label: t(BREAK_LABEL[days]),
    detail: t('player.profile.breakUntil', { until: formatDayTime(new Date((openedAt ?? 0) + days * DAY_MS)) }),
  }));
  const choose = async (value: string) => {
    const days = BREAK_DAYS.find((choice) => String(choice) === value);
    if (days !== undefined) await takeBreak.mutateAsync(days);
    setOpenedAt(null);
  };
  return (
    <Stack gap={3} align="start">
      <Heading level={2}>{t('player.profile.selfExclusion')}</Heading>
      {restrictions.breakUntil === null ? (
        <Button variant="secondary" onClick={() => setOpenedAt(Date.now())}>{t('player.profile.takeBreak')}</Button>
      ) : (
        <Text>{t('player.tonight.breakActive', { until: formatDayTime(new Date(restrictions.breakUntil)) })}</Text>
      )}
      {takeBreak.data?.ok === false ? <Text>{t('player.profile.saveFailed')}</Text> : null}
      <ChoiceSheet isOpen={openedAt !== null} title={t('player.profile.takeBreak')} description={t('player.profile.breakIntro')}
        choices={choices} isBusy={takeBreak.isPending} onChoose={(value) => void choose(value)} onCancel={() => setOpenedAt(null)} />
    </Stack>
  );
}
