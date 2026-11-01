import { PROMOTION_BUILDER_LIMITS, PROMOTION_BUILDER_REWARDS, type PromotionBuilder } from '@rivr/contracts';
import type { PromotionStake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, Heading, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { dayName, stakeLabel } from './promotionCopy.ts';

const DAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
// The prototype's start and end times. The night ends at 06:00 (decision 0140), so no window runs past it.
const STARTS = ['14:00', '18:00', '20:00', '22:00'] as const;
const ENDS = ['20:00', '02:00', '04:00', '06:00'] as const;
const EVERY_STAKE = 'all';

interface BlocksProps {
  choices: PromotionBuilder;
  stakes: readonly PromotionStake[];
  onChange: (choices: PromotionBuilder) => void;
  isDisabled: boolean;
}

const first = (values: readonly string[]): string | null => values[0] ?? null;

function WhenBlock({ choices, onChange, isDisabled }: Omit<BlocksProps, 'stakes'>) {
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.promotions.when')}</Heading>
      <ChoiceChips label={t('console.promotions.days')} isLabelVisuallyHidden options={DAYS.map((day) => ({ value: day, label: dayName(Number(day)) }))}
        selected={choices.days.map(String)} isDisabled={isDisabled} onChange={(days) => onChange({ ...choices, days: days.map(Number) })} />
      <Inline gap={4} wrap>
        <ChoiceChips label={t('console.promotions.from')} mode="one" options={STARTS.map((time) => ({ value: time, label: time }))}
          selected={choices.from === null ? [] : [choices.from]} isDisabled={isDisabled} onChange={(from) => onChange({ ...choices, from: first(from) })} />
        <ChoiceChips label={t('console.promotions.to')} mode="one" options={ENDS.map((time) => ({ value: time, label: time }))}
          selected={choices.until === null ? [] : [choices.until]} isDisabled={isDisabled} onChange={(until) => onChange({ ...choices, until: first(until) })} />
      </Inline>
    </Stack>
  );
}

/** The reward; for the buy-in bonus the most it gives on one buy-in (question #415), for the hours bonus its hours and chips (#646). */
function RewardBlock({ choices, onChange, isDisabled }: Omit<BlocksProps, 'stakes'>) {
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('console.promotions.reward')} mode="one" selected={[choices.reward]} isDisabled={isDisabled}
        options={PROMOTION_BUILDER_REWARDS.map((reward) => ({ value: reward, label: t(`console.promotions.rewards.${reward}`) }))}
        onChange={(picked) => onChange({ ...choices, reward: PROMOTION_BUILDER_REWARDS.find((reward) => reward === picked[0]) ?? choices.reward })} />
      {choices.reward === 'buy_in_bonus' ? (
        <WholeInput label={t('console.promotions.bonusCap')} value={choices.bonus_cap_rupees} isDisabled={isDisabled}
          onValue={(cap) => onChange({ ...choices, bonus_cap_rupees: cap })} />
      ) : null}
      {choices.reward === 'hours_bonus' ? (
        <Inline gap={4} wrap>
          <WholeInput label={t('console.promotions.bonusHours')} value={choices.bonus_hours} isDisabled={isDisabled}
            onValue={(hours) => onChange({ ...choices, bonus_hours: hours })} />
          <WholeInput label={t('console.promotions.bonusChips')} value={choices.bonus_chips} isDisabled={isDisabled}
            onValue={(chips) => onChange({ ...choices, bonus_chips: chips })} />
        </Inline>
      ) : null}
    </Stack>
  );
}

/** A whole number as typed, kept as text so a half-typed one stays on screen; Publish checks it. */
function WholeInput({ label, value, isDisabled, onValue }: { label: string; value: number; isDisabled: boolean; onValue: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <Input label={label} inputMode="numeric" value={text} disabled={isDisabled}
      onChange={(event) => {
        setText(event.target.value);
        onValue(Number(event.target.value.replaceAll(',', '')));
      }} />
  );
}

/**
 * The builder's four blocks only, as in the prototype (#84): When (days and an IST window), Who (a
 * stake or all), Reward and Limits, each a row of chips.
 */
export function BuilderBlocks({ choices, stakes, onChange, isDisabled }: BlocksProps) {
  const stakeOptions = [{ value: EVERY_STAKE, label: t('console.promotions.allStakes') }, ...stakes.map((stake) => ({ value: stake.code, label: stakeLabel(stake) }))];
  return (
    <Stack gap={6} divided>
      <WhenBlock choices={choices} onChange={onChange} isDisabled={isDisabled} />
      <ChoiceChips label={t('console.promotions.who')} mode="one" options={stakeOptions} selected={[choices.stake ?? EVERY_STAKE]} isDisabled={isDisabled}
        onChange={(picked) => onChange({ ...choices, stake: first(picked) === EVERY_STAKE ? null : first(picked) })} />
      <RewardBlock choices={choices} onChange={onChange} isDisabled={isDisabled} />
      <ChoiceChips label={t('console.promotions.limits')} mode="one" selected={[choices.limit]} isDisabled={isDisabled}
        options={PROMOTION_BUILDER_LIMITS.map((limit) => ({ value: limit, label: t(`console.promotions.limitOptions.${limit}`) }))}
        onChange={(picked) => onChange({ ...choices, limit: PROMOTION_BUILDER_LIMITS.find((limit) => limit === picked[0]) ?? choices.limit })} />
    </Stack>
  );
}
