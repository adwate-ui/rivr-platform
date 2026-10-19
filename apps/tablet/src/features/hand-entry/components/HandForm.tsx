import type { TableRules } from '@rivr/db';
import { potTake } from '@rivr/domain/rake';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Keypad, Stack } from '@rivr/ui';
import { Controller } from 'react-hook-form';
import { useHandEntryForm } from '../hooks/useHandEntryForm.ts';
import { useHighHandClaim } from '../hooks/useHighHandClaim.ts';
import { logFailureText, variantOptions } from './handCopy.ts';
import { HighHandFields } from './HighHandFields.tsx';
import { TakeSummary } from './TakeSummary.tsx';

/**
 * The game, the pot keypad and Log hand, with the rake, drop and pull as the pot is typed, and the
 * High hand switch: a claim sent to the floor with the hand (#47).
 */
export function HandForm({ rules }: { rules: TableRules }) {
  const highHand = useHighHandClaim();
  const { form, typed, pot, submit, failure, isPending } = useHandEntryForm(highHand);
  return (
    <Stack gap={4}>
      <TakeSummary pot={pot} take={potTake(pot, rules.rake)} cap={rules.rake.cap} />
      {form.formState.errors.pot ? <ErrorMessage>{t('tablet.handEntry.notChips', { amount: formatMoney(pot) })}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{logFailureText(failure)}</ErrorMessage>}
      <Controller control={form.control} name="variant" render={({ field }) => (
        // Pressing the chosen game again keeps it: a double tap never turns PLO into Hold'em.
        <ChoiceChips label={t('tablet.handEntry.variant')} mode="one" selected={[field.value]} options={variantOptions(rules.hasVariation)}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} isDisabled={isPending} />
      )} />
      <Controller control={form.control} name="pot" render={({ field }) => (
        <Keypad label={t('tablet.handEntry.enterPot')} value={field.value} onChange={field.onChange} isDisabled={isPending} />
      )} />
      <HighHandFields highHand={highHand} isDisabled={isPending} />
      <Button variant="primary" size="large" fullWidth isLoading={isPending} isDisabled={typed === ''} onClick={() => void submit()}>
        {t('tablet.handEntry.log')}
      </Button>
    </Stack>
  );
}
