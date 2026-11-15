import { t } from '@rivr/i18n';
import { useState } from 'react';
import { Text } from '../Text/Text.tsx';
import { rangeText, readUnit, type Unit, type UnitRange } from '../UnitInput/unit.ts';
import { UnitField } from '../UnitInput/UnitField.tsx';

/** A stake and the value it has now. */
export interface StakeValue {
  readonly id: string;
  /** The stake as it is written everywhere: "NLH 100/200". */
  readonly name: string;
  /** Null for a stake that has none yet. */
  readonly value: number | null;
}

/** Each stake's value by the stake's id; null for a stake left with none. */
export type StakeValueMap = Readonly<Record<string, number | null>>;

export interface StakeValuesProps {
  /** What is set for each stake, read as the group's name: "Call time". */
  label: string;
  /** Every stake, with the value it has now. */
  stakes: readonly StakeValue[];
  /** What each value counts, shown after it. */
  unit: Unit;
  /** The least a value may be. */
  min: number;
  /** The most a value may be. */
  max: number;
  /** Every stake's value; null altogether while any value typed is outside the range, so the screen saves nothing. */
  onChange: (values: StakeValueMap | null) => void;
}

/** What is typed for each stake, by its id. */
type Typed = Readonly<Record<string, string>>;

/** Every stake's value as typed, or null while any is refused. */
function valuesOf(stakes: readonly StakeValue[], typed: Typed, range: UnitRange): StakeValueMap | null {
  const readings = stakes.map((stake) => ({ id: stake.id, ...readUnit(typed[stake.id] ?? '', range) }));
  return readings.some((reading) => reading.isRefused) ? null : Object.fromEntries(readings.map(({ id, value }) => [id, value]));
}

/**
 * One value for each stake (redesign RD-14), such as its call time: a field per stake under the stake's name, in one
 * unit. A stake that has no value keeps its field, with "Not set" under it, so every stake is in the list; a value outside
 * `min` to `max` is refused, with the range under it. It keeps what is typed, so the screen mounts it anew (a `key`) to
 * start from other values.
 */
export function StakeValues({ label, stakes, unit, min, max, onChange }: StakeValuesProps) {
  const range = { min, max };
  const [typed, setTyped] = useState<Typed>(() => Object.fromEntries(stakes.map((stake) => [stake.id, stake.value === null ? '' : String(stake.value)])));
  if (stakes.length === 0) return <Text tone="muted">{t('ui.console.stakeValues.empty')}</Text>;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-4">
      {stakes.map((stake) => {
        const own = typed[stake.id] ?? '';
        return (
          <UnitField key={stake.id} label={stake.name} unit={unit} typed={own} hint={own === '' ? t('ui.console.stakeValues.none') : undefined}
            error={readUnit(own, range).isRefused ? rangeText(unit, range) : undefined}
            onTyped={(next) => {
              const all = { ...typed, [stake.id]: next };
              setTyped(all);
              onChange(valuesOf(stakes, all, range));
            }} />
        );
      })}
    </div>
  );
}
