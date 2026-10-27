import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, StatusMessage } from '@rivr/ui';

/** What the last save said: saved, or what went wrong. */
export interface SaveOutcome {
  readonly ok: boolean;
  readonly text: string;
}

interface SaveRowProps {
  isSaving: boolean;
  onSave: () => void;
  /** Cancel, when a saved item is being changed. */
  onCancel?: (() => void) | undefined;
  outcome: SaveOutcome | null;
}

/** Save, and Cancel while changing one; then what the save said. */
export function SaveRow({ isSaving, onSave, onCancel, outcome }: SaveRowProps) {
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center">
        <Button variant="primary" isLoading={isSaving} onClick={onSave}>{t('console.tournaments.save')}</Button>
        {onCancel === undefined ? null : <Button variant="text" onClick={onCancel}>{t('console.tournaments.cancel')}</Button>}
        <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      </Inline>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
