import type { MemberListRow } from '@rivr/db';
import { formatIsoDay, t } from '@rivr/i18n';
import type { DataTableExportColumn } from '@rivr/ui';

type Column = DataTableExportColumn<MemberListRow>;

/** A day as a spreadsheet sorts it, `2026-11-02`, or nothing. */
const day = (at: string | null) => (at === null ? '' : formatIsoDay(new Date(at)));

/** The sign-up answers in words, as sign-up named them to the member. */
const ANSWERS: readonly Column[] = [
  {
    key: 'occupation', header: t('console.members.signUp.occupation'),
    exportValue: (row) => (row.details.occupation === null ? '' : t(`console.members.signUp.occupations.${row.details.occupation}`)),
  },
  {
    key: 'playTimes', header: t('console.members.signUp.playTimes'),
    exportValue: (row) => row.details.playTimes.map((time) => t(`console.members.signUp.playTimeNames.${time}`)).join(', '),
  },
  {
    key: 'games', header: t('console.members.signUp.games'),
    exportValue: (row) => row.details.gamesPlayed.map((game) => t(`console.members.signUp.gameNames.${game}`)).join(', '),
  },
];

/** How they came: the code they joined with, a creator's, the campaign's codes, and when the club first saw them. */
const HOW_THEY_CAME: readonly Column[] = [
  { key: 'joinedWith', header: t('console.members.signUp.exported.joinedWith'), exportValue: (row) => row.details.referralCode ?? '' },
  { key: 'creator', header: t('console.members.signUp.creatorCode'), exportValue: (row) => row.details.creatorCode ?? '' },
  { key: 'source', header: t('console.members.signUp.exported.source'), exportValue: (row) => row.details.campaign.source ?? '' },
  { key: 'medium', header: t('console.members.signUp.exported.medium'), exportValue: (row) => row.details.campaign.medium ?? '' },
  { key: 'campaign', header: t('console.members.signUp.exported.campaignName'), exportValue: (row) => row.details.campaign.name ?? '' },
  { key: 'content', header: t('console.members.signUp.exported.content'), exportValue: (row) => row.details.campaign.content ?? '' },
  { key: 'term', header: t('console.members.signUp.exported.term'), exportValue: (row) => row.details.campaign.term ?? '' },
  { key: 'firstSeen', header: t('console.members.signUp.firstSeen'), exportValue: (row) => day(row.details.firstSeenAt) },
];

/** The identity check: how it was done and when it was finished. */
const CHECK: readonly Column[] = [
  {
    key: 'kycMethod', header: t('console.members.signUp.exported.kycMethod'),
    exportValue: (row) => {
      const method = row.details.kycMethod;
      return method === 'digilocker' || method === 'pan' || method === 'manual' ? t(`console.members.signUp.exported.kycMethods.${method}`) : '';
    },
  },
  { key: 'kycVerified', header: t('console.members.signUp.exported.kycVerified'), exportValue: (row) => day(row.details.kycVerifiedAt) },
];

/** Their identity documents, for super admins (the owner, 9 Nov). */
const DOCUMENTS: readonly Column[] = [
  { key: 'dateOfBirth', header: t('console.members.signUp.exported.dateOfBirth'), exportValue: (row) => row.details.dateOfBirth ?? '' },
  { key: 'pan', header: t('console.members.signUp.exported.pan'), exportValue: (row) => row.details.pan ?? '' },
  { key: 'aadhaar', header: t('console.members.signUp.exported.aadhaar'), exportValue: (row) => row.details.maskedAadhaar ?? '' },
  { key: 'aadhaarName', header: t('console.members.signUp.exported.aadhaarName'), exportValue: (row) => row.details.aadhaarName ?? '' },
  { key: 'address', header: t('console.members.signUp.exported.address'), exportValue: (row) => row.details.address ?? '' },
];

/**
 * What a Members export adds after the table's own columns (the owner, 9 Nov: "include all the member related fields"):
 * the name given at sign-up, their own referral code, last visit, the sign-up answers, how they came and the identity
 * check; and, for a super admin (`seesIdentity`), their identity documents.
 */
export function memberExportColumns(seesIdentity: boolean): readonly Column[] {
  return [
    { key: 'knownAs', header: t('console.members.signUp.exported.knownAs'), exportValue: (row) => row.details.knownAs ?? '' },
    { key: 'ownCode', header: t('console.members.signUp.exported.ownCode'), exportValue: (row) => row.details.ownReferralCode ?? '' },
    { key: 'lastVisit', header: t('console.members.signUp.exported.lastVisit'), exportValue: (row) => day(row.lastVisitAt) },
    ...ANSWERS, ...HOW_THEY_CAME, ...CHECK, ...(seesIdentity ? DOCUMENTS : []),
  ];
}
