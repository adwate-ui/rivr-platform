import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { Label } from '../Label/Label.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** The native input attributes forms need; works with React Hook Form's `register`. */
type NativeInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'autoComplete' | 'inputMode' | 'maxLength' | 'required' | 'disabled' | 'readOnly'
>;

export interface InputProps extends NativeInputProps {
  /** The visible label. Every input has one. */
  label: string;
  /** One line under the field that helps fill it in. */
  hint?: string | undefined;
  /** What is wrong and what to do, in one or two lines. Marks the field invalid. */
  error?: string | undefined;
  type?: 'text' | 'tel' | 'email' | 'password' | 'search' | 'url';
  ref?: Ref<HTMLInputElement>;
}

const FIELD =
  'min-h-touch w-full rounded-md border bg-raised px-3 font-text text-16 text-content transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-disabled';

/** A labelled text field with an optional hint and an error message. */
export function Input({ label, hint, error, type = 'text', ...native }: InputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cx(hint && hintId, error && errorId) || undefined;
  return (
    <Stack gap={2}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        className={cx(FIELD, error ? 'border-alert' : 'border-hairline')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...native}
      />
      {hint ? (
        <Text variant="small" tone="muted" id={hintId}>
          {hint}
        </Text>
      ) : null}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </Stack>
  );
}

/** The error line: an alert icon and the message in cream, so it never relies on red text. */
function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <div className="flex items-start gap-2 text-content">
      <Icon name="alert" size="sm" />
      <Text variant="small" id={id}>
        {message}
      </Text>
    </div>
  );
}
