import { t } from '@rivr/i18n';
import { useEffect, useRef } from 'react';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Input, type InputProps } from '../Input/Input.tsx';
import { Stack } from '../Stack/Stack.tsx';

/**
 * The reason field's own attributes: what React Hook Form's `register('reason')` returns (name, change and
 * blur handlers, ref), or `value` and `onChange` for a controlled field.
 */
export type ReasonFieldProps = Pick<InputProps, 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'>;

/** A decision the reason is given for: its button. */
export interface ReasonAction {
  /** A verb, sentence case: "Revoke the tablet", "Approve". */
  label: string;
  onClick: () => void;
}

export interface ReasonFormProps {
  /** The reason field: `form.register('reason')`, or `value` and `onChange`. */
  field: ReasonFieldProps;
  /** Asks for the reason: "Why it is revoked". */
  label: string;
  /** One line under the field that helps fill it in. */
  hint?: string | undefined;
  /** Why the reason will not do, and what to write. Marks the field invalid. */
  error?: string | undefined;
  /** The longest reason the form's schema takes, where the field should stop there. */
  maxLength?: number | undefined;
  /** The decisions, in order, as buttons under the field; each label once. Most forms have one. */
  actions: readonly ReasonAction[];
  /** `danger`, the default, fills the buttons red, as for revoking a tablet; `secondary` outlines them, as for KYC review's Approve and Reject. */
  variant?: 'danger' | 'secondary';
  /** While a decision is being saved: every decision button shows the loading label and ignores presses. */
  isLoading?: boolean;
  /** Adds Cancel, which closes the form without deciding. Leave it out where the form stays open. */
  onCancel?: (() => void) | undefined;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])';

/** Each ancestor of `element`, a few levels up, with the place among its children of the branch that holds `element`. */
function placesOf(element: Element): readonly (readonly [Element, number])[] {
  const places: (readonly [Element, number])[] = [];
  for (let node = element; node.parentElement !== null && places.length < 4; node = node.parentElement) {
    places.push([node.parentElement, [...node.parentElement.children].indexOf(node)]);
  }
  return places;
}

/** What should hold the focus once the form has gone: the control now standing where the form stood, if any. */
function standIn(places: readonly (readonly [Element, number])[]): HTMLElement | null {
  const [parent, index] = places.find(([ancestor]) => ancestor.isConnected) ?? [];
  const child = parent === undefined || index === undefined ? undefined : parent.children[index];
  const target = child?.matches(FOCUSABLE) ? child : child?.querySelector(FOCUSABLE);
  return target instanceof HTMLElement ? target : null;
}

/**
 * A form opened by a control (one with Cancel) takes the focus to its field, and Cancel gives it back (#758): to the
 * control that opened it while that is still on the page, otherwise to the control that took the form's place, as Void
 * does when its button gives way to the form.
 */
function useFocusAround(onCancel: (() => void) | undefined) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const isOpened = onCancel !== undefined;
  useEffect(() => {
    if (!isOpened) return;
    // The opener held the focus before the form took it; under StrictMode this runs twice, and the form is never its own opener.
    if (!root.current?.contains(document.activeElement)) opener.current = document.activeElement;
    root.current?.querySelector('input')?.focus();
  }, [isOpened]);
  const cancel = () => {
    const back = opener.current;
    const places = root.current === null ? [] : placesOf(root.current);
    onCancel?.();
    // Once the app has drawn what replaces the form.
    setTimeout(() => (back instanceof HTMLElement && back.isConnected && back !== document.body ? back : standIn(places))?.focus());
  };
  return { root, cancel };
}

/**
 * A required reason and the decision it is given for, such as revoking a tablet or rejecting a claim:
 * the field, then a button for each decision and Cancel. It holds no state and is not a `<form>`, so Enter
 * submits nothing: the app's form checks the reason against its schema when a decision is pressed and
 * passes the error in (decision 0211). The field is always required, as every reason schema needs one.
 * Opened by a control, it takes the focus to the field, and Cancel gives it back (#758).
 */
export function ReasonForm({ field, label, hint, error, maxLength, actions, variant = 'danger', isLoading = false, onCancel }: ReasonFormProps) {
  const { root, cancel } = useFocusAround(onCancel);
  return (
    <div ref={root}>
      <Stack gap={3}>
        <Input {...field} label={label} hint={hint} error={error} maxLength={maxLength} autoComplete="off" required />
        <Inline gap={3} wrap>
          {actions.map((action) => (
            <Button key={action.label} variant={variant} isLoading={isLoading} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
          {onCancel ? (
            <Button variant="text" onClick={cancel}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </Inline>
      </Stack>
    </div>
  );
}
