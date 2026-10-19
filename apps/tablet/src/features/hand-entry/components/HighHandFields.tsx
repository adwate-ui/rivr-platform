import { HIGH_HAND_CATEGORIES, HIGH_HAND_RANKS } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Stack, Switch, Text } from '@rivr/ui';
import { Controller, useWatch } from 'react-hook-form';
import type { useHighHandClaim } from '../hooks/useHighHandClaim.ts';
import { highHandFailureText } from './handCopy.ts';

const CATEGORY_OPTIONS = HIGH_HAND_CATEGORIES.map((category) => ({ value: category, label: t(`tv.highHand.${category}`) }));
const RANK_OPTIONS = HIGH_HAND_RANKS.map((rank) => ({ value: rank, label: t(`tv.ranks.${rank}`) }));
const SEAT_OPTIONS = Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));

type HighHand = ReturnType<typeof useHighHandClaim>;

/** What came of the last claim: sent to the floor, or not (the hand is logged), with Send again. */
function ClaimNoteLine({ highHand }: { highHand: HighHand }) {
  const note = highHand.note;
  if (note === null) return null;
  if (note.kind === 'sent') return <Text>{t('tablet.highHand.sent')}</Text>;
  return (
    <Stack gap={2} align="start">
      <ErrorMessage>{`${t('tablet.highHand.notSent')} ${highHandFailureText(note.failure, note.values.seat)}`}</ErrorMessage>
      <Button variant="secondary" isLoading={highHand.isPending} onClick={() => void highHand.send(note.handId, note.values)}>
        {t('tablet.highHand.sendAgain')}
      </Button>
    </Stack>
  );
}

/**
 * The High hand switch on hand entry, as in the prototype: on, the dealer picks the type of hand,
 * the seat and a four of a kind's rank, and the claim goes to the floor with the hand.
 */
export function HighHandFields({ highHand, isDisabled }: { highHand: HighHand; isDisabled: boolean }) {
  const { control, formState: { errors } } = highHand.form;
  const category = useWatch({ control, name: 'category' });
  return (
    <Stack gap={3}>
      <Switch label={t('tablet.highHand.toggle')} hint={t('tablet.highHand.toggleHint')} isOn={highHand.isOn} onChange={highHand.turn} isDisabled={isDisabled} />
      {highHand.isOn ? (
        <Stack gap={3}>
          <Controller control={control} name="category" render={({ field }) => (
            <ChoiceChips label={t('tablet.highHand.category')} mode="one" selected={field.value === undefined ? [] : [field.value]}
              options={CATEGORY_OPTIONS} isDisabled={isDisabled} onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
          )} />
          {category === 'four_of_a_kind' ? (
            <Controller control={control} name="rank" render={({ field }) => (
              <ChoiceChips label={t('tablet.highHand.rank')} mode="one" selected={field.value === null ? [] : [field.value]}
                options={RANK_OPTIONS} isDisabled={isDisabled} onChange={(chosen) => field.onChange(chosen[0] ?? null)} />
            )} />
          ) : null}
          <Controller control={control} name="seat" render={({ field }) => (
            <ChoiceChips label={t('tablet.highHand.seat')} mode="one" selected={field.value === undefined ? [] : [String(field.value)]}
              options={SEAT_OPTIONS} isDisabled={isDisabled} onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(Number(chosen[0])); }} />
          )} />
          {errors.category || errors.seat ? <ErrorMessage>{t('tablet.highHand.pickTypeAndSeat')}</ErrorMessage> : null}
          {errors.rank ? <ErrorMessage>{t('tablet.highHand.pickRank')}</ErrorMessage> : null}
        </Stack>
      ) : null}
      <ClaimNoteLine highHand={highHand} />
    </Stack>
  );
}
