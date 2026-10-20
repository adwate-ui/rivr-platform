import { useThisComputer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Text } from '@rivr/ui';

/**
 * At a venue that enforces cage computers (#384), says when this one is not enrolled as the cage, so a
 * refusal is not a surprise; the refusal itself is the database's.
 */
export function CageComputerBanner({ venueId }: { venueId: string }) {
  const here = useThisComputer(venueId);
  if (here.data === undefined || !here.data.isEnforced || here.data.computer?.kind === 'cage') return null;
  return <Box surface="alert" padding={3} radius="sm"><Text tone="onAlert">{t('console.cage.notCageComputer')}</Text></Box>;
}
