import { t } from '@rivr/i18n';
import { Button, Inline } from '@rivr/ui';

/** The foot of a setup panel: Cancel, then Save, the panel's one gold button, busy while it saves. */
export function SaveFooter({ isSaving, onCancel, onSave }: { isSaving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={isSaving} onClick={onSave}>{t('console.tablesSetup.save')}</Button>
    </Inline>
  );
}
