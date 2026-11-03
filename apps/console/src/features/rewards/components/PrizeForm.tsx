import { useSpinWheelActions, type SpinPrizeKind } from '@rivr/db/spin';
import { parseRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Segmented, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { prizeLabel } from './prizeLabel.ts';

const KINDS: readonly SpinPrizeKind[] = ['points', 'bonus', 'nothing'];
const WHOLE = /^\d{1,7}$/;

/** The amount as typed: points as a whole number, bonus chips as paise, nothing as 0; null when it does not read. */
function amountOf(kind: SpinPrizeKind, text: string): bigint | null {
  if (kind === 'nothing') return 0n;
  if (kind === 'points') return WHOLE.test(text.trim()) ? BigInt(text.trim()) : null;
  const paise = parseRupees(text);
  return paise.ok ? paise.value : null;
}

/** Adds the prize typed; the words to say, or null while nothing was sent. */
function useAddPrize(venueId: string) {
  const { add } = useSpinWheelActions(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (kind: SpinPrizeKind, amount: string, weight: string) => {
    const value = amountOf(kind, amount);
    if (value === null || !WHOLE.test(weight.trim())) {
      setOutcome({ ok: false, text: t('console.spin.failures.invalid') });
      return false;
    }
    const done = await add.mutateAsync({ kind, amount: value, weight: Number(weight.trim()) });
    setOutcome(done.ok ? { ok: true, text: t('console.spin.added', { prize: prizeLabel({ kind, amount: value }) }) }
      : { ok: false, text: t(`console.spin.failures.${done.error}`) });
    return done.ok;
  };
  return { send, outcome, isPending: add.isPending };
}

/**
 * A new prize at the end of the wheel (#150), in one row under it as in the prototype: points, bonus chips in whole 50s
 * (#629) or nothing, and its weight. A bonus the month's spin budget cannot pay goes on the wheel, and its row says it is off.
 */
export function PrizeForm({ venueId }: { venueId: string }) {
  const prize = useAddPrize(venueId);
  const [kind, setKind] = useState<SpinPrizeKind>('points');
  const [amount, setAmount] = useState('');
  const [weight, setWeight] = useState('1');
  const submit = () => void prize.send(kind, amount, weight).then((isAdded) => { if (isAdded) setAmount(''); });
  return (
    <Stack gap={3}>
      <Inline gap={3} align="end" wrap>
        <Segmented label={t('console.spin.kind')} size="compact" value={kind} onChange={setKind}
          options={KINDS.map((each) => ({ value: each, label: t(`console.spin.kinds.${each}`) }))} />
        {kind === 'nothing' ? null : (
          <Input label={t(kind === 'points' ? 'console.spin.points' : 'console.spin.bonus')} value={amount} inputMode="numeric" autoComplete="off"
            onChange={(event) => setAmount(event.target.value)} />
        )}
        <Input label={t('console.spin.weight')} value={weight} inputMode="numeric" autoComplete="off" onChange={(event) => setWeight(event.target.value)} />
        <Button variant="subtle" size="compact" isLoading={prize.isPending} onClick={submit}>{t('console.spin.add')}</Button>
      </Inline>
      <Text variant="small" tone="muted">{t('console.spin.weightHint')}</Text>
      <StatusMessage>{prize.outcome?.ok === true ? prize.outcome.text : null}</StatusMessage>
      {prize.outcome?.ok === false ? <ErrorMessage>{prize.outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
