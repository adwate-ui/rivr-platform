import { t } from '@rivr/i18n';
import { useId, useState } from 'react';
import { Button } from '../Button/Button.tsx';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { Sheet } from '../Sheet/Sheet.tsx';

/** One option: the value stored and what it says. */
export interface PickerOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export interface PickerSheetProps<Value extends string> {
  /** The field's label, inside its box, and the sheet's title: "Occupation". */
  label: string;
  options: readonly PickerOption<Value>[];
  /** `one` closes as an option is picked; `many` closes with Done or the scrim. */
  mode?: 'one' | 'many';
  selected: readonly Value[];
  onChange: (selected: Value[]) => void;
  /** What the field says with nothing picked: "Select". */
  placeholder: string;
  /** What is wrong, under the field. Edges the field in red. */
  error?: string | undefined;
}

const FIELD =
  'flex min-h-field w-full items-center justify-between gap-3 rounded-lg border bg-raised px-4 py-2 text-start text-content';

const OPTION = 'flex min-h-round w-full items-center justify-between gap-3 border-t border-cream-faint px-1 text-start font-text text-16 text-content';

/** The radio or checkbox at an option's right: gold and ticked when picked. */
function Mark({ isOn, isMany }: { isOn: boolean; isMany: boolean }) {
  return (
    <span aria-hidden="true" className={cx('flex size-6 shrink-0 items-center justify-center border text-on-action',
      isMany ? 'rounded-sm' : 'rounded-full', isOn ? 'border-action bg-action' : 'border-control')}>
      {isOn ? <Icon name="check" size="sm" /> : null}
    </span>
  );
}

interface OptionsProps<Value extends string> {
  label: string;
  options: readonly PickerOption<Value>[];
  selected: readonly Value[];
  isMany: boolean;
  onPress: (value: Value) => void;
}

/** The sheet's rows, each 52 px with its radio or checkbox at the right. */
function Options<Value extends string>({ label, options, selected, isMany, onPress }: OptionsProps<Value>) {
  return (
    <div role="group" aria-label={label} className="flex flex-col">
      {options.map((option) => {
        const isOn = selected.includes(option.value);
        return (
          <button key={option.value} type="button" aria-pressed={isOn} className={OPTION} onClick={() => onPress(option.value)}>
            {option.label}
            <Mark isOn={isOn} isMany={isMany} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A field that opens a sheet of options (decision 0320), in place of chips: the label inside a 60 px box, the value picked
 * (or several, comma-joined) and a chevron. One option closes the sheet as it is picked; several close with Done.
 */
export function PickerSheet<Value extends string>({ label, options, mode = 'one', selected, onChange, placeholder, error }: PickerSheetProps<Value>) {
  const [isOpen, setOpen] = useState(false);
  const errorId = useId();
  const isMany = mode === 'many';
  const shown = options.filter((option) => selected.includes(option.value)).map((option) => option.label).join(', ');
  const press = (value: Value) => {
    const isOn = selected.includes(value);
    if (!isMany) {
      onChange([value]);
      setOpen(false);
      return;
    }
    onChange(isOn ? selected.filter((each) => each !== value) : [...selected, value]);
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-haspopup="dialog" aria-describedby={error ? errorId : undefined} onClick={() => setOpen(true)}
        className={cx(FIELD, error ? 'border-alert' : 'border-cream-faint')}>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-text text-12 text-content-muted">{label}</span>
          <span className={cx('font-text text-16', shown ? 'text-content' : 'text-content-muted')}>{shown || placeholder}</span>
        </span>
        <span className="text-content-muted"><Icon name="chevronDown" size="md" /></span>
      </button>
      {error ? <ErrorMessage id={errorId} look="dot">{error}</ErrorMessage> : null}
      <Sheet isOpen={isOpen} onClose={() => setOpen(false)} title={label} titleLook="plain" aside={t(isMany ? 'ui.picker.chooseAny' : 'ui.picker.chooseOne')}>
        <Options label={label} options={options} selected={selected} isMany={isMany} onPress={press} />
        <Button variant="primary" size="tall" fullWidth onClick={() => setOpen(false)}>{t('ui.picker.done')}</Button>
      </Sheet>
    </div>
  );
}
