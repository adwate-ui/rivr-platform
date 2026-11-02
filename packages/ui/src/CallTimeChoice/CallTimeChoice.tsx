import { formatDuration, t } from '@rivr/i18n';
import { useState } from 'react';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Input } from '../Input/Input.tsx';
import { Stack } from '../Stack/Stack.tsx';

export interface CallTimeChoiceProps {
  /** The club's usual call times, in minutes, as chips: `[180, 240, 300]`. */
  choices: readonly number[];
  /** The minutes chosen at first: one of `choices`, or any other as Custom. */
  initial: number;
  /** The minutes chosen, or null while Custom holds no whole number. */
  onChange: (minutes: number | null) => void;
}

const CUSTOM = 'custom';

/** Whole minutes typed, or null. */
const minutesIn = (text: string) => (/^\d{1,4}$/.test(text) ? Number(text) : null);

/**
 * The call time the floor gives a player as it seats them (decision 0299): the club's usual times as chips, `3 h`, `4 h`,
 * `5 h`, and Custom, which asks for minutes. Whether the minutes are allowed is the app's to check.
 */
export function CallTimeChoice({ choices, initial, onChange }: CallTimeChoiceProps) {
  const isUsual = choices.includes(initial);
  const [chosen, setChosen] = useState(isUsual ? String(initial) : CUSTOM);
  const [typed, setTyped] = useState(isUsual ? '' : String(initial));
  const options = [...choices.map((minutes) => ({ value: String(minutes), label: formatDuration(minutes * 60) })), { value: CUSTOM, label: t('ui.callTime.custom') }];
  return (
    <Stack gap={2}>
      <ChoiceChips label={t('ui.callTime.choose')} mode="one" selected={[chosen]} options={options}
        onChange={([value]) => {
          if (value === undefined) return;
          setChosen(value);
          onChange(value === CUSTOM ? minutesIn(typed) : Number(value));
        }} />
      {chosen === CUSTOM ? (
        // In a row, so the field is as wide as four digits need, not the form.
        <Inline gap={4}>
          <Input label={t('ui.callTime.minutes')} hint={t('ui.callTime.minutesHint')} value={typed} inputMode="numeric" maxLength={4} autoComplete="off"
            onChange={(event) => {
              const text = event.target.value.trim();
              setTyped(text);
              onChange(minutesIn(text));
            }} />
        </Inline>
      ) : null}
    </Stack>
  );
}
