import { useVenueConfig } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Banner } from '@rivr/ui';

/** Across the top while the club has no alert number, so the owner's alerts reach no one (audit F-212). Nothing until it is known. */
export function NoAlertNumberBanner({ venueId, onAdd }: { venueId: string; onAdd: () => void }) {
  const config = useVenueConfig(venueId).data;
  if (config === undefined || config === null || config.alertWhatsapp !== null) return null;
  return <Banner isFullWidth action={{ label: t('console.shell.addAlertNumber'), onPress: onAdd }}>{t('console.shell.noAlertNumber')}</Banner>;
}
