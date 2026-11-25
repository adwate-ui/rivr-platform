import { useMemberSignUp, type MemberSignUp as SignUp } from '@rivr/db';
import { formatDate, formatDateTime, t } from '@rivr/i18n';
import { DetailRow, Heading, LoadState, Stack } from '@rivr/ui';
import { MemberReferrer } from './MemberReferrer.tsx';

/** A list of answers in words, or Not given. */
const listed = (words: readonly string[]) => (words.length === 0 ? t('console.members.signUp.notGiven') : words.join(', '));
const given = (text: string | null) => text ?? t('console.members.signUp.notGiven');

/** The campaign in one line, `instagram · social · diwali`, from whichever of its codes the link had. */
function campaignLine(signUp: SignUp): string | null {
  const { source, medium, campaign, content, term } = signUp.campaign;
  const codes = [source, medium, campaign, content, term].filter((code) => code !== null);
  return codes.length === 0 ? null : codes.join(' · ');
}

/** Their answers: the day they joined, city, occupation, when they play and the games they play. */
function Answers({ signUp }: { signUp: SignUp }) {
  const occupation = signUp.occupation === null ? null : t(`console.members.signUp.occupations.${signUp.occupation}`);
  return (
    <Stack gap={0}>
      <DetailRow label={t('console.members.signUp.signedUp')} value={formatDate(new Date(signUp.signedUpAt))} labelTone="muted" size="small" />
      <DetailRow label={t('console.members.city')} value={given(signUp.city)} labelTone="muted" size="small" />
      <DetailRow label={t('console.members.signUp.occupation')} value={given(occupation)} labelTone="muted" size="small" />
      <DetailRow label={t('console.members.signUp.playTimes')} labelTone="muted" size="small"
        value={listed(signUp.playTimes.map((time) => t(`console.members.signUp.playTimeNames.${time}`)))} />
      <DetailRow label={t('console.members.signUp.games')} labelTone="muted" size="small" isLast
        value={listed(signUp.gamesPlayed.map((game) => t(`console.members.signUp.gameNames.${game}`)))} />
    </Stack>
  );
}

/**
 * How they came: a referral or creator code, the campaign, and when the club first saw them; Not given for each the link
 * lacked. Then who referred them, which the floor and up set (the owner, 25 Nov).
 */
function HowTheyCame({ venueId, memberId, signUp, canSetReferrer }: { venueId: string; memberId: string; signUp: SignUp; canSetReferrer: boolean }) {
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.members.signUp.howTheyCame')}</Heading>
      <Stack gap={0}>
        <DetailRow label={t('console.members.signUp.referralCode')} value={given(signUp.referralCode)} labelTone="muted" size="small" />
        <DetailRow label={t('console.members.signUp.creatorCode')} value={given(signUp.creatorCode)} labelTone="muted" size="small" />
        <DetailRow label={t('console.members.signUp.campaign')} value={given(campaignLine(signUp))} labelTone="muted" size="small" />
        <DetailRow label={t('console.members.signUp.firstSeen')} labelTone="muted" size="small"
          value={signUp.firstSeenAt === null ? t('console.members.signUp.notGiven') : formatDateTime(new Date(signUp.firstSeenAt))} />
      </Stack>
      <MemberReferrer venueId={venueId} memberId={memberId} signUp={signUp} canSet={canSetReferrer} />
    </Stack>
  );
}

/** The member's sign-up on their record (owner, 8 Nov): their answers, then how they came to the club and who referred them. */
export function MemberSignUp({ venueId, memberId, canSetReferrer = false }: { venueId: string; memberId: string; canSetReferrer?: boolean }) {
  const signUp = useMemberSignUp(venueId, memberId);
  if (signUp.isError) return <LoadState isError onRetry={() => void signUp.refetch()} />;
  if (signUp.data === undefined) return <LoadState />;
  if (signUp.data === null) return null;
  return (
    <Stack gap={6}>
      <Answers signUp={signUp.data} />
      <HowTheyCame venueId={venueId} memberId={memberId} signUp={signUp.data} canSetReferrer={canSetReferrer} />
    </Stack>
  );
}
