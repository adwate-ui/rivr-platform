import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { Label } from '../Label/Label.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** The native input attributes forms need; works with React Hook Form's `register`. */
type NativeInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'autoComplete'
  | 'autoFocus'
  | 'inputMode'
  | 'maxLength'
  | 'placeholder'
  | 'required'
  | 'disabled'
  | 'readOnly'
>;

/**
 * `boxed` for forms; `line`, an underline, for a screen with one field, such as the sign-in
 * number; `code`, a large letter-spaced underline, for a one-time code.
 */
export type InputVariant = 'boxed' | 'line' | 'code';

export interface InputProps extends NativeInputProps {
  /** The visible label. Every input has one. */
  label: string;
  /** One line under the field that helps fill it in. */
  hint?: string | undefined;
  /** What is wrong and what to do, in one or two lines. Marks the field invalid. */
  error?: string | undefined;
  type?: 'text' | 'tel' | 'email' | 'password' | 'search' | 'url' | 'date';
  variant?: InputVariant;
  /** Fixed text before the value that is not typed, such as `+91`. Read out with the field. */
  prefix?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

// The line and the code are sized as in the prototype's sign-in: a 48 px row for the number, and
// large digits set apart for a code (the prototype's 32 px, at 28 on the type scale).
const FRAME: Record<InputVariant, string> = {
  boxed: 'min-h-touch w-full rounded-md border bg-raised px-3 font-text text-16 text-content',
  line: 'min-h-12 w-full border-b bg-transparent font-text text-20 tracking-wide text-content',
  code: 'min-h-touch w-full border-b bg-transparent py-2 font-text text-28 tracking-code text-content',
};

const STATE = 'transition-colors placeholder:text-content-muted disabled:cursor-not-allowed';

// A plain input dims itself when disabled; with a prefix the whole row dims, prefix included.
const DIMMED = 'disabled:opacity-disabled';
const ROW_DIMMED = 'has-disabled:opacity-disabled';

/** A labelled text field with an optional prefix, hint and error message. */
export function Input({ label, hint, error, type = 'text', variant = 'boxed', prefix, ...native }: InputProps) {
  const id = useId();
  const describedBy = cx(prefix && `${id}-prefix`, hint && `${id}-hint`, error && `${id}-error`) || undefined;
  return (
    <Stack gap={2}>
      <Label htmlFor={id}>{label}</Label>
      <Field id={id} type={type} variant={variant} prefix={prefix} isInvalid={Boolean(error)} describedBy={describedBy} native={native} />
      {hint ? (
        <Text variant="small" tone="muted" id={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
    </Stack>
  );
}

interface FieldProps {
  id: string;
  type: NonNullable<InputProps['type']>;
  variant: InputVariant;
  prefix: string | undefined;
  isInvalid: boolean;
  describedBy: string | undefined;
  native: NativeInputProps;
}

/** The input itself, inside its frame. With a prefix the frame runs under the prefix and the value together. */
function Field({ id, type, variant, prefix, isInvalid, describedBy, native }: FieldProps) {
  const frame = cx(FRAME[variant], isInvalid ? 'border-alert' : 'border-hairline');
  const input = (
    <input
      id={id}
      type={type}
      // With a prefix the input still fills the row's full touch height, so a tap beside the value focuses it.
      className={prefix ? cx('min-h-touch min-w-0 flex-1 bg-transparent', STATE) : cx(frame, STATE, DIMMED)}
      aria-invalid={isInvalid || undefined}
      aria-describedby={describedBy}
      {...native}
    />
  );
  if (!prefix) return input;
  return (
    // data-field-row: the focus ring goes round the whole row, prefix included (styles.css).
    <div data-field-row className={cx(frame, ROW_DIMMED, 'flex items-baseline gap-3')}>
      <span id={`${id}-prefix`} className="text-18 tracking-normal text-content-muted">
        {prefix}
      </span>
      {input}
    </div>
  );
}

/** The error line, which the field points at. */
function FieldError({ id, message }: { id: string; message: string }) {
  return <ErrorMessage id={id}>{message}</ErrorMessage>;
}
