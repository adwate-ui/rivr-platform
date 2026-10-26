import { t } from '@rivr/i18n';
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

/**
 * A required reason and the decision it is given for, such as revoking a tablet or rejecting a claim:
 * the field, then a button for each decision and Cancel. It holds no state and is not a `<form>`, so Enter
 * submits nothing: the app's form checks the reason against its schema when a decision is pressed and
 * passes the error in (decision 0211). The field is always required, as every reason schema needs one.
 */
export function ReasonForm({ field, label, hint, error, maxLength, actions, variant = 'danger', isLoading = false, onCancel }: ReasonFormProps) {
  return (
    <Stack gap={3}>
      <Input {...field} label={label} hint={hint} error={error} maxLength={maxLength} autoComplete="off" required />
      <Inline gap={3} wrap>
        {actions.map((action) => (
          <Button key={action.label} variant={variant} isLoading={isLoading} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
        {onCancel ? (
          <Button variant="text" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
      </Inline>
    </Stack>
  );
}
