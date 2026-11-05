import { useKycRecord } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, NoticeCard } from '@rivr/ui';

/**
 * On Tonight for a member let in by their selfie (decision 0502), until the desk has checked them: what to bring on the
 * first visit, as a card above the club's notices.
 */
export function DeskCheckNotice() {
  const kyc = useKycRecord();
  if (kyc.data?.status !== 'started' || !kyc.data.isAtTheClub) return null;
  return (
    <Box paddingX={5}>
      <NoticeCard label={t('player.kyc.deskCheck')} text={t('player.kyc.atTheDesk')} />
    </Box>
  );
}
