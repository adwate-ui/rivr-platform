import { useVenueConfig } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Banner } from '@rivr/ui';

/**
 * Across the top while the owner's alerts reach no one (audit F-212): with no WhatsApp on production (decision 0697), only alert
 * emails reach anyone, so until they are on with an address. Nothing until it is known.
 */
export function NoAlertEmailBanner({ venueId, onAdd }: { venueId: string; onAdd: () => void }) {
  const config = useVenueConfig(venueId).data;
  if (config === undefined || config === null || (config.alertEmailOn && config.alertEmails.length > 0)) return null;
  return (
    <Banner isFullWidth action={{ label: t('console.shell.setUpAlertEmails'), name: t('console.shell.setUpAlertEmailsName'), onPress: onAdd }}>
      {t('console.shell.noAlertEmail')}
    </Banner>
  );
}
