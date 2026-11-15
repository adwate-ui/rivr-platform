import { useKycRecord } from '@rivr/db';
import type { MyNotice } from '@rivr/db/notices';
import { homeTopSlot, type SeatStanding } from '@rivr/domain/notices';
import { t } from '@rivr/i18n';
import { Box, NoticeCard } from '@rivr/ui';

/**
 * Home's one card above the offers (redesign RD-20), as `homeTopSlot` in @rivr/domain/notices rules: the member's ID
 * check while it is not done, tinged red so it reads apart from the club's words (the owner, 12 Nov); once it is done, the
 * club's notice in force that started last; nothing while a seat is called for them or taken. Nothing closes it. Nothing
 * shows until the check is read, so no card comes and goes.
 */
export function TopSlot({ seat, notices }: { seat: SeatStanding; notices: readonly MyNotice[] }) {
  const kyc = useKycRecord();
  if (kyc.data === undefined) return null;
  const slot = homeTopSlot({
    seat,
    isIdCheckDone: kyc.data?.status === 'verified',
    notices: notices.map((notice) => ({ body: notice.body, startsAt: new Date(notice.startsAt) })),
  });
  if (slot === null) return null;
  return (
    <Box paddingX={5}>
      {slot.kind === 'idCheck'
        ? <NoticeCard tone="alert" label={t('player.kyc.deskCheck')} text={t('player.kyc.atTheDesk')} />
        : <NoticeCard label={t('player.live.notice')} text={slot.notice.body} />}
    </Box>
  );
}
