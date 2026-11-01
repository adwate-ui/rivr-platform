import { t } from '@rivr/i18n';
import { useId, useLayoutEffect, useRef } from 'react';
import { Button } from '../Button/index.ts';
import { Inline } from '../Inline/index.ts';
import { Stack } from '../Stack/index.ts';
import { Text } from '../Text/index.ts';

export interface ConfirmQuestionProps {
  /** What is about to happen, as a question: "Change Ayesha Thomas's role to Host?". */
  question: string;
  /** The change's button, starting "Yes": "Yes, change it". */
  confirm: string;
  /** While the change is saved: Yes shows it, and neither button takes a press, so it is never sent twice or seems undone. */
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A change picked on the screen (a chip, a switch, a choice in a sheet), asked before it is saved: the question, then
 * "Yes, …" or Cancel. The question describes the Yes button, so a screen reader reads it there; once it is answered and
 * goes, the focus goes back to what asked, such as the switch. For a step asked twice on one button, use ConfirmButton.
 */
export function ConfirmQuestion({ question, confirm, isBusy = false, onConfirm, onCancel }: ConfirmQuestionProps) {
  const questionId = useId();
  const answers = useRef<HTMLDivElement>(null);
  // What had the focus when the question came; a layout effect's cleanup runs before the buttons leave the page.
  useLayoutEffect(() => {
    const asker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = answers.current;
    return () => {
      if (asker?.isConnected === true && buttons?.contains(document.activeElement) === true) asker.focus();
    };
  }, []);
  return (
    <Stack gap={2}>
      <Text id={questionId}>{question}</Text>
      <div ref={answers}>
        <Inline gap={3} wrap>
          <Button variant="secondary" aria-describedby={questionId} isLoading={isBusy} onClick={onConfirm}>{confirm}</Button>
          <Button variant="text" isDisabled={isBusy} onClick={onCancel}>{t('common.cancel')}</Button>
        </Inline>
      </div>
    </Stack>
  );
}
