import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Text } from '../Text/Text.tsx';

/** One choice in the sheet: the value it stands for, what it says, and a detail on the right. */
export interface SheetChoice<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly detail?: string;
}

export interface ChoiceSheetProps<Value extends string> {
  isOpen: boolean;
  title: string;
  /** What choosing does, under the title. */
  description: string;
  choices: readonly SheetChoice<Value>[];
  onChoose: (value: Value) => void;
  /** Cancel, Escape or a tap outside the sheet. */
  onCancel: () => void;
  /** Ignores choices while the one picked is saved. */
  isBusy?: boolean;
}

const CHOICE =
  'flex min-h-touch w-full items-center justify-between gap-4 border-t border-hairline py-4 text-start text-content ' +
  'focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled';

/**
 * A sheet that rises from the bottom of a phone screen to ask for one choice, such as how long a
 * break lasts: a title, what choosing does, a row per choice with its detail, and Cancel. Focus
 * stays in the sheet until it closes.
 */
export function ChoiceSheet<Value extends string>({ isOpen, title, description, choices, onChoose, onCancel, isBusy }: ChoiceSheetProps<Value>) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-green-black opacity-muted" />
        {/* Focus moves to the sheet itself, not its first choice, so no choice looks picked as it opens. */}
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-modal mx-auto flex max-w-phone flex-col gap-2 rounded-t-lg bg-raised px-6 pt-6 pb-8 shadow-modal focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
        >
          <Dialog.Title className="font-text text-20 leading-snug font-semibold text-content">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <Text tone="muted">{description}</Text>
          </Dialog.Description>
          <div className="mt-4 flex flex-col border-b border-hairline">
            {choices.map((choice) => (
              <button key={choice.value} type="button" className={CHOICE} disabled={isBusy} onClick={() => onChoose(choice.value)}>
                <Text as="span">{choice.label}</Text>
                {/* A space between, so a screen reader reads "24 hours Until …" rather than one word. */}
                {choice.detail ? <>{' '}<Text as="span" variant="small" tone="muted">{choice.detail}</Text></> : null}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
