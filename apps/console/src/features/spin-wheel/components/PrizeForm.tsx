import { useSpinWheelActions, type SpinPrizeKind } from '@rivr/db/spin';
import { parseRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Input, Stack, StatusMessage } from '@rivr/ui';
import { useState } from 'react';
import { prizeLabel } from './prizeLabel.ts';

const KINDS: readonly SpinPrizeKind[] = ['points', 'bonus', 'nothing'];
const WHOLE = /^\d{1,7}$/;

/** The amount as typed: points as a whole number, a bonus in rupees as paise, nothing as 0; null when it does not read. */
function amountOf(kind: SpinPrizeKind, text: string): bigint | null {
  if (kind === 'nothing') return 0n;
  if (kind === 'points') return WHOLE.test(text.trim()) ? BigInt(text.trim()) : null;
  const paise = parseRupees(text);
  return paise.ok ? paise.value : null;
}

/** A new prize at the end of the wheel (#150): points, a bonus in whole ₹50 chips, or nothing, and its weight. */
export function PrizeForm({ venueId }: { venueId: string }) {
  const { add } = useSpinWheelActions(venueId);
  const [kind, setKind] = useState<SpinPrizeKind>('points');
  const [amount, setAmount] = useState('');
  const [weight, setWeight] = useState('1');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = () => {
    const value = amountOf(kind, amount);
    if (value === null || !WHOLE.test(weight.trim())) {
      setOutcome({ ok: false, text: t('console.spin.failures.invalid') });
      return;
    }
    void add.mutateAsync({ kind, amount: value, weight: Number(weight.trim()) }).then((done) => {
      setOutcome(done.ok ? { ok: true, text: t('console.spin.added', { prize: prizeLabel({ kind, amount: value }) }) }
        : { ok: false, text: t(`console.spin.failures.${done.error}`) });
      if (done.ok) setAmount('');
    });
  };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.spin.addTitle')}</Heading>
      <ChoiceChips label={t('console.spin.kind')} mode="one" selected={[kind]}
        options={KINDS.map((each) => ({ value: each, label: t(`console.spin.kinds.${each}`) }))} onChange={(chosen) => setKind(chosen[0] ?? kind)} />
      {kind === 'nothing' ? null : (
        <Input label={t(kind === 'points' ? 'console.spin.points' : 'console.spin.bonus')} hint={kind === 'bonus' ? t('console.spin.bonusHint') : undefined}
          value={amount} inputMode="numeric" autoComplete="off" onChange={(event) => setAmount(event.target.value)} />
      )}
      <Input label={t('console.spin.weight')} hint={t('console.spin.weightHint')} value={weight} inputMode="numeric" autoComplete="off"
        onChange={(event) => setWeight(event.target.value)} />
      <Button variant="secondary" isLoading={add.isPending} onClick={submit}>{t('console.spin.add')}</Button>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
