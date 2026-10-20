import { useId, type Ref, type TextareaHTMLAttributes } from 'react';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage.tsx';
import { cx } from '../internal/classes.ts';
import { Label } from '../Label/Label.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** The native textarea attributes forms need; works with React Hook Form's `register`. */
type NativeTextAreaProps = Pick<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'autoFocus' | 'maxLength' | 'placeholder' | 'required' | 'disabled' | 'readOnly'
>;

export interface TextAreaProps extends NativeTextAreaProps {
  /** The visible label. Every field has one. */
  label: string;
  /** One line under the field that helps fill it in. */
  hint?: string | undefined;
  /** What is wrong and what to do, in one or two lines. Marks the field invalid. */
  error?: string | undefined;
  /** How many lines show before it scrolls; it can be pulled taller. */
  rows?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

const FRAME =
  'w-full resize-y rounded-md border bg-raised px-3 py-2 font-text text-16 leading-normal text-content ' +
  'transition-colors placeholder:text-content-muted disabled:cursor-not-allowed disabled:opacity-disabled';

/** A labelled field for text of several lines, such as an SOP, with an optional hint and error message. */
export function TextArea({ label, hint, error, rows = 8, ...native }: TextAreaProps) {
  const id = useId();
  const describedBy = cx(hint && `${id}-hint`, error && `${id}-error`) || undefined;
  return (
    <Stack gap={2}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        className={cx(FRAME, error ? 'border-alert' : 'border-hairline')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...native}
      />
      {hint ? (
        <Text variant="small" tone="muted" id={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
      {error ? <ErrorMessage id={`${id}-error`}>{error}</ErrorMessage> : null}
    </Stack>
  );
}
