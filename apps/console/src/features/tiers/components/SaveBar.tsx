import { t } from '@rivr/i18n';
import { Button, ChoiceChips, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

type When = 'now' | 'date';

// Today's date on the club's clock, as a date field gives it: 2026-10-20.
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

interface SaveBarProps {
  count: number;
  isSaving: boolean;
  /** Saves from now (null) or from midnight IST on a later day, as `2026-10-25T00:00:00+05:30`. */
  onSave: (from: string | null) => void;
  onDiscard: () => void;
}

/** The changes made on screen, and when they take effect: now, or from a later day. Saving asks for the date first. */
export function SaveBar({ count, isSaving, onSave, onDiscard }: SaveBarProps) {
  const [when, setWhen] = useState<When>('now');
  const [date, setDate] = useState('');
  const [isDateInvalid, setIsDateInvalid] = useState(false);
  const save = () => {
    if (when === 'now') return onSave(null);
    // A later day only: today's midnight has passed, and the database refuses the past.
    const isLater = /^\d{4}-\d{2}-\d{2}$/.test(date) && date > IST_DAY.format(new Date());
    setIsDateInvalid(!isLater);
    if (isLater) onSave(`${date}T00:00:00+05:30`);
  };
  return (
    <Stack gap={3}>
      <Text weight="semibold">{count === 1 ? t('console.tiers.unsavedOne') : t('console.tiers.unsaved', { count })}</Text>
      <ChoiceChips label={t('console.tiers.when')} mode="one" selected={[when]} isDisabled={isSaving}
        options={[{ value: 'now', label: t('console.tiers.now') }, { value: 'date', label: t('console.tiers.fromDate') }]}
        onChange={(chosen) => { if (chosen[0] !== undefined) setWhen(chosen[0]); }} />
      {when === 'date' ? (
        <Input type="date" label={t('console.tiers.date')} value={date} onChange={(event) => setDate(event.target.value)}
          error={isDateInvalid ? t('console.tiers.invalidDate') : undefined} />
      ) : null}
      <Inline gap={3}>
        <Button isLoading={isSaving} onClick={save}>{t('console.tiers.save')}</Button>
        <Button variant="text" isDisabled={isSaving} onClick={onDiscard}>{t('console.tiers.discard')}</Button>
      </Inline>
    </Stack>
  );
}
