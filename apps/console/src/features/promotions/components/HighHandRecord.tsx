import { HIGH_HANDS } from '@rivr/contracts/promotionModel';
import { useHighHandTonight, type HighHandHit, type PromotionOverview } from '@rivr/db';
import { budgetLeft, type HighHandReward, type Terms } from '@rivr/domain/promotions';
import { formatHighHand, formatListedHand, formatNumber, t } from '@rivr/i18n';
import { Button, ConfirmButton, DetailRow, Grid, Inline, LoadState, Number as Count, Segmented, Sheet, Stack, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { canEnd, capitalised, type RowSteps } from './listColumns.tsx';
import { whoAndWhen, type PromotionNames } from './promotionWords.ts';

const TABS = ['paid', 'terms'] as const;
type RecordTab = (typeof TABS)[number];

/** Whether a promotion has a record to open beside the list: a high hand that has a version of its own running or run. */
export function hasRecord(promotion: PromotionOverview): boolean {
  return promotion.terms?.reward.kind === 'high_hand' && promotion.currentVersionId !== null;
}

/** A figure or a word under its label, two a row: "Hands paid tonight 3", "Players dealt in 4 or more". */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={1}>
      <Text variant="caption" tone="muted">{label}</Text>
      {children}
    </Stack>
  );
}

const Figure = ({ value, label }: { value: number; label: string }) => <Fact label={label}><Count value={value} size="lead" /></Fact>;
const Word = ({ value, label }: { value: string; label: string }) => <Fact label={label}><Text variant="lead" weight="medium">{value}</Text></Fact>;

/** One hit of tonight on a line: the player, the hand named exactly with its table and seat, and the Bonus paid. */
function HitRow({ hit }: { hit: HighHandHit }) {
  const where = t('console.promotions.record.hit', { hand: formatHighHand(hit.hand, hit.rank), table: hit.tableName, seat: hit.seat });
  return (
    <Inline gap={3} justify="between" align="center">
      <Text as="span" variant="row" weight="medium">{hit.memberName}</Text>
      <Inline gap={3} grow justify="end">
        <Text as="span" variant="secondary" tone="muted" truncate>{where}</Text>
        <Text as="span" variant="row" isTabular>{t('console.promotions.record.paid', { chips: formatNumber(hit.chips) })}</Text>
      </Inline>
    </Inline>
  );
}

interface PaidProps {
  venueId: string;
  promotion: PromotionOverview;
  terms: Terms;
  /** Opens the Live floor's logging panel; none for staff who may not log one, or while it is not live. */
  onLog: (() => void) | undefined;
}

/** Paid tonight: the night's hands and Bonus, the week's Bonus, what is left of the budget, Log a high hand, and tonight's hits. */
function Paid({ venueId, promotion, terms, onLog }: PaidProps) {
  const tonight = useHighHandTonight(venueId, promotion.id);
  const left = budgetLeft(terms.limits, { chipsGiven: promotion.budgetUsedChips ?? 0 });
  const isMonthly = terms.limits.budgetPeriod === 'month';
  if (tonight.data === undefined) return <LoadState isError={tonight.isError} onRetry={() => void tonight.refetch()} />;
  return (
    <Stack gap={4}>
      <Grid columns={2} gap={4}>
        <Figure value={tonight.data.handsPaid} label={t('console.promotions.record.handsTonight')} />
        <Figure value={tonight.data.chipsPaid} label={t('console.promotions.record.bonusTonight')} />
        <Figure value={promotion.chipsGivenThisWeek} label={t('console.promotions.record.thisWeek')} />
        {left === null ? null : <Figure value={left} label={t(isMonthly ? 'console.promotions.record.budgetLeftMonth' : 'console.promotions.record.budgetLeft')} />}
      </Grid>
      {onLog === undefined ? null : <Inline><Button variant="strong" size="compact" onClick={onLog}>{t('console.promotions.record.log')}</Button></Inline>}
      {tonight.data.hits.length === 0
        ? <Text tone="muted">{t('console.promotions.record.none')}</Text>
        : <Stack divided>{tonight.data.hits.map((hit) => <HitRow key={hit.id} hit={hit} />)}</Stack>}
    </Stack>
  );
}

interface HandsAndRulesProps {
  reward: HighHandReward;
  where: string;
  /** Opens the builder on it; none once it has ended. */
  onChange: (() => void) | undefined;
}

/** Hands and rules: each hand of the list with its Bonus, or not paid; then the three rules and where it runs. */
function HandsAndRules({ reward, where, onChange }: HandsAndRulesProps) {
  const yesNo = (isHeld: boolean) => t(isHeld ? 'console.promotions.record.yes' : 'console.promotions.record.no');
  const notPaid = HIGH_HANDS.filter((hand) => !reward.hands.some((listed) => listed.hand === hand));
  return (
    <Stack gap={4}>
      <Text variant="eyebrow" tone="muted">{t('console.promotions.record.bonusForEachHand')}</Text>
      <Stack gap={0}>
        {reward.hands.map((listed) => <DetailRow key={listed.hand} label={formatListedHand(listed.hand)} value={formatNumber(listed.chips)} />)}
        {notPaid.map((hand) => <DetailRow key={hand} label={formatListedHand(hand)} labelTone="muted" value={t('console.promotions.record.notPaid')} valueTone="muted" />)}
      </Stack>
      <Text variant="eyebrow" tone="muted">{t('console.promotions.record.rules')}</Text>
      <Grid columns={2} gap={4}>
        <Word label={t('console.promotions.builder.fields.bothHoleCards')} value={yesNo(reward.rules.bothHoleCards)} />
        <Word label={t('console.promotions.builder.fields.shownAtShowdown')} value={yesNo(reward.rules.shownAtShowdown)} />
        <Word label={t('console.promotions.record.playersDealt')} value={t('console.promotions.record.orMore', { count: reward.rules.minPlayersDealt })} />
        <Word label={t('console.promotions.record.where')} value={where} />
      </Grid>
      {onChange === undefined ? null : <Inline><Button variant="subtle" size="compact" onClick={onChange}>{t('console.promotions.record.change')}</Button></Inline>}
    </Stack>
  );
}

interface HighHandRecordProps {
  venueId: string;
  promotion: PromotionOverview;
  names: PromotionNames;
  /** The list's own Pause, Resume, End and Edit. */
  steps: RowSteps;
  onLog: (() => void) | undefined;
  onClose: () => void;
}

/** The record's foot: End, Edit, and Pause or Resume, as the list's row has them. */
function RecordActions({ promotion, steps, onClose }: Pick<HighHandRecordProps, 'promotion' | 'steps' | 'onClose'>) {
  const { name, status } = promotion;
  const isLive = status === 'live';
  return (
    <>
      {canEnd(promotion) ? (
        <ConfirmButton label={t('console.promotions.list.end')} name={t('console.promotions.list.endNamed', { name })} variant="subtle"
          confirm={t('console.promotions.list.confirmEnd', { name })} isBusy={steps.isBusy} onConfirm={() => { steps.end(promotion); onClose(); }} />
      ) : null}
      {status === 'ended' ? null : <Button variant="subtle" onClick={() => steps.open(promotion)}>{t('console.promotions.list.edit')}</Button>}
      {isLive || status === 'paused' ? (
        <Button variant="primary" isDisabled={steps.isBusy} onClick={() => (isLive ? steps.pause(promotion) : steps.resume(promotion))}>
          {t(isLive ? 'console.promotions.list.pause' : 'console.promotions.list.resume')}
        </Button>
      ) : null}
    </>
  );
}

/**
 * A high hand promotion's record, beside the list (redesign RD-23): what was paid tonight and this week and what is left
 * of its budget, with Log a high hand; and its hands and rules.
 */
export function HighHandRecord({ venueId, promotion, names, steps, onLog, onClose }: HighHandRecordProps) {
  const [tab, setTab] = useState<RecordTab>('paid');
  const { terms, status } = promotion;
  if (terms === null || terms.reward.kind !== 'high_hand') return null;
  return (
    <Sheet place="console" isOpen onClose={onClose} title={promotion.name} footer={<RecordActions promotion={promotion} steps={steps} onClose={onClose} />}
      subtitle={t('console.promotions.record.subtitle', { status: t(`console.promotions.statuses.${status}`) })}>
      <Segmented label={promotion.name} size="small" value={tab} onChange={setTab}
        options={TABS.map((value) => ({ value, label: t(`console.promotions.record.tabs.${value}`) }))} />
      {tab === 'paid'
        ? <Paid venueId={venueId} promotion={promotion} terms={terms} onLog={status === 'live' ? onLog : undefined} />
        : <HandsAndRules reward={terms.reward} where={capitalised(whoAndWhen(terms, names).who)} onChange={status === 'ended' ? undefined : () => steps.open(promotion)} />}
    </Sheet>
  );
}
