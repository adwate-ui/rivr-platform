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
  | 'onKeyDown'
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
 * number; `inset`, the player redesign's 60 px box with its label inside (decision 0320). A one-time code is a CodeInput.
 */
export type InputVariant = 'boxed' | 'line' | 'inset';

export interface InputProps extends NativeInputProps {
  /** The visible label. Every input has one. */
  label: string;
  /** One line under the field that helps fill it in. */
  hint?: string | undefined;
  /** What is wrong and what to do, in one or two lines. Marks the field invalid. */
  error?: string | undefined;
  type?: 'text' | 'tel' | 'email' | 'password' | 'search' | 'url' | 'date';
  variant?: InputVariant;
  /** Fixed text before the value that is not typed, such as `+91` or `₹`. Read out with the field. */
  prefix?: string | undefined;
  /** Fixed text after the value that is not typed, such as `%` or `minutes` (#603). Read out with the field. */
  suffix?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

// The line is sized as in the prototype's sign-in: a 48 px row for the number, in plain spacing (S-01: tracked tabular
// figures read as a typewriter). Its focus is its own line, drawn thicker (styles.css), never a box round it.
const FRAME: Record<Exclude<InputVariant, 'inset'>, string> = {
  boxed: 'min-h-touch w-full rounded-md border bg-raised px-3 font-text text-16 text-content',
  line: 'min-h-12 w-full border-b bg-transparent font-text text-20 text-content',
};

const STATE = 'transition-colors placeholder:text-content-muted disabled:cursor-not-allowed';

// A plain input dims itself when disabled; with a prefix the whole row dims, prefix included.
const DIMMED = 'disabled:opacity-disabled';
const ROW_DIMMED = 'has-disabled:opacity-disabled';

/** A labelled text field with an optional prefix, suffix, hint and error message. */
export function Input({ variant = 'boxed', ...props }: InputProps) {
  const id = useId();
  if (variant === 'inset') return <InsetInput id={id} label={props.label} error={props.error} type={props.type ?? 'text'} native={nativeOf(props)} />;
  return <FramedInput id={id} variant={variant} {...props} />;
}

/** The input's own attributes, without the props Input reads itself. */
function nativeOf({ label: _label, hint: _hint, error: _error, type: _type, prefix: _prefix, suffix: _suffix, ...native }: Omit<InputProps, 'variant'>): NativeInputProps {
  return native;
}

/** A boxed or line field: its label above, then the field, its hint and its error. */
function FramedInput({ id, variant, label, hint, error, type = 'text', prefix, suffix, ...native }: Omit<InputProps, 'variant'> & { id: string; variant: Exclude<InputVariant, 'inset'> }) {
  const describedBy = cx(prefix && `${id}-prefix`, suffix && `${id}-suffix`, hint && `${id}-hint`, error && `${id}-error`) || undefined;
  return (
    <Stack gap={2}>
      <Label htmlFor={id}>{label}</Label>
      <Field id={id} type={type} variant={variant} prefix={prefix} suffix={suffix} isInvalid={Boolean(error)} describedBy={describedBy} native={native} />
      {hint ? (
        <Text variant="small" tone="muted" id={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
    </Stack>
  );
}

interface InsetInputProps {
  id: string;
  label: string;
  error: string | undefined;
  type: NonNullable<InputProps['type']>;
  native: NativeInputProps;
}

/**
 * The player redesign's field (decision 0320): a raised 60 px box with its label small and muted inside, above the value; a
 * red edge and the dotted error under it while it is wrong. The whole box is the field's label, so a tap anywhere focuses it.
 */
function InsetInput({ id, label, error, type, native }: InsetInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={cx('flex min-h-field flex-col justify-center gap-1 rounded-lg border bg-raised px-4 py-2',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-focus', error ? 'border-alert' : 'border-control')}>
        <span className="font-text text-12 text-content-muted">{label}</span>
        <input id={id} type={type} className={cx('w-full bg-transparent p-0 font-text text-16 text-content outline-none', STATE)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...native} />
      </label>
      {error ? <ErrorMessage id={`${id}-error`} look="dot">{error}</ErrorMessage> : null}
    </div>
  );
}

interface FieldProps {
  id: string;
  type: NonNullable<InputProps['type']>;
  variant: Exclude<InputVariant, 'inset'>;
  prefix: string | undefined;
  suffix: string | undefined;
  isInvalid: boolean;
  describedBy: string | undefined;
  native: NativeInputProps;
}

/** Fixed text beside the value: a prefix or a suffix, read with the field. */
function Adornment({ id, text }: { id: string; text: string }) {
  // The field's own size, so +91 reads as part of the number (P-07).
  return <span id={id} className="tracking-normal text-content-muted">{text}</span>;
}

/** A line field's line in the focus colour while it has focus, unless it is wrong (S-01): on its row when it has a prefix or suffix. */
function lineFocusClass(variant: Exclude<InputVariant, 'inset'>, isInvalid: boolean, isAdorned: boolean): string | undefined {
  if (variant !== 'line' || isInvalid) return undefined;
  return isAdorned ? 'has-[input:focus-visible]:border-focus' : 'focus-visible:border-focus';
}

/** The input itself, inside its frame. With a prefix or a suffix the frame runs under them and the value together. */
function Field({ id, type, variant, prefix, suffix, isInvalid, describedBy, native }: FieldProps) {
  const isAdorned = Boolean(prefix) || Boolean(suffix);
  const frame = cx(FRAME[variant], isInvalid ? 'border-alert' : 'border-control', lineFocusClass(variant, isInvalid, isAdorned));
  const line = variant === 'line' ? { 'data-line': '' } : {};
  const input = (
    <input
      id={id}
      type={type}
      {...(isAdorned ? {} : line)}
      // With a prefix the input still fills the row's full touch height, so a tap beside the value focuses it.
      className={isAdorned ? cx('min-h-touch min-w-0 flex-1 bg-transparent', STATE) : cx(frame, STATE, DIMMED)}
      aria-invalid={isInvalid || undefined}
      aria-describedby={describedBy}
      {...native}
    />
  );
  if (!isAdorned) return input;
  return (
    // data-field-row: the focus ring goes round the whole row, prefix and suffix included (styles.css).
    <div data-field-row {...line} className={cx(frame, ROW_DIMMED, 'flex items-baseline gap-3')}>
      {prefix ? <Adornment id={`${id}-prefix`} text={prefix} /> : null}
      {input}
      {suffix ? <Adornment id={`${id}-suffix`} text={suffix} /> : null}
    </div>
  );
}

/** The error line, which the field points at. */
function FieldError({ id, message }: { id: string; message: string }) {
  return <ErrorMessage id={id}>{message}</ErrorMessage>;
}
