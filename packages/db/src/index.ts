export { createRivrClient, SESSION_STORAGE_KEY, type RivrClient, type RivrClientOptions } from './client.ts';
export type { Database } from './database.types.ts';
export { RivrDataProvider, useAuthStatus, useReportFailure, useRivrData, type AuthStatus, type FailureReport } from './provider.tsx';
export { useMember, type Member } from './member.ts';
export { useFeature, useFeatureStatus, type FeatureStatus } from './hooks.ts';
export { useSignIn, useSignOut, type SignInResult } from './signIn.ts';
// The website's reads are at @rivr/db/site, so the apps' bundles never carry their schemas.
// Lane A's money hooks (cage, credit, treasury, expenses...) are listed in money.ts, so lanes rarely edit the same list.
export * from './money.ts';
export { PRACTICE_KEY, StaffVenueProvider, useStaffVenue, useStaffVenues, type StaffVenue, type StaffVenueState } from './staff.tsx';
export {
  useStaffActions, useStaffRemovals, useVenueStaff, type StaffChange, type StaffFailure, type StaffMember, type StaffRemoval,
} from './venueStaff.ts';
export {
  GAMES_PLAYED, OCCUPATIONS, PLAY_TIMES, useSignedInPhone, storedReferralCode, useSignUp, type GamePlayed, type Occupation, type PlayTime, type SignUpDetails,
  type SignUpFailure,
} from './signUp.ts';
export { rememberAttribution, storedAttribution, type SignUpAttribution } from './attribution.ts';
export { KYC_IMAGE_URL_SECONDS, useKycImageUrl, useMyPhotoPath } from './kycImages.ts';
export { toBase64, useKycActions, useKycAtTheClub, useKycRecord, type KycRecord, type KycStatus } from './kyc.ts';
export { shrinkPhoto } from './photo.ts';
export { itemPhotoUrl, useItemPhotoUpload, type ItemPhotoFailure, type ItemPhotoOrder } from './itemPhotos.ts';
export {
  useKycDuplicateHolder,
  useKycInPerson,
  useKycDueTonight,
  useKycInPersonCandidates,
  useKycReviewActions,
  useKycReviewPage,
  useVenueKycAtTheClub,
  type KycCandidate,
  type KycCheck,
  type KycDecision,
  type KycInPersonFailure,
  type KycInPersonOutcome,
  type KycRefusal,
  type KycRetake,
  type KycReviewFailure,
  type KycWaitReason,
} from './kycReview.ts';
export type { KycDocumentKind } from '@rivr/contracts';
export { useKycAadhaarCovers, useKycDocumentRetake, useMemberKycDocuments, useSendBackKycDocument, type KycDocument, type KycSendBackFailure } from './kycDocuments.ts';
export {
  GAMES,
  PUSH_CHOICES,
  usePreferenceActions,
  usePreferences,
  useStakes,
  type Game,
  type Preferences,
  type PushChoice,
  type Stake,
} from './preferences.ts';
export { usePushSubscriptionActions } from './push.ts';
export { useLiveStatusDeviceActions, type LiveStatusDeviceToSave } from './liveStatus.ts';
export { useCheckInActions, useCheckOutActions, type CheckInFailure, type CheckOutFailure, type CheckOutRefusal } from './visits.ts';
export { useDoorPage, type DoorListName, type DoorPlayer, type DoorStatus } from './door.ts';
export { useFnbOff } from './fnbOn.ts';
export {
  LIST_PAGE, useListChoices, useListPage, type ListChoices, type ListFilter, type ListName, type ListPage, type ListView, type ScopedView,
} from './lists.ts';
export {
  useFeedbackActions, useFeedbackCounts, useFeedbackPage, useMyFeedbackVisit, useOpenFeedbackPage, useResolveFeedback, type FeedbackCounts, type FeedbackFailure, type FeedbackItem,
  type FeedbackListName, type FeedbackRatings, type OpenFeedback, type ResolveFeedbackFailure,
  type FeedbackVisit,
} from './feedback.ts';
export { ACTIVITY_KINDS, ACTIVITY_PAGE, useActivityPage, type ActivityFilters, type ActivityKind, type ActivityLine } from './activityLog.ts';
export * from './floorReports.ts';
export {
  openSeatsAt, useFloorSeats, useHeldSeats, useLeftOwingCallTime, useSeatActions, useSetSeatCallTime, useDecideCallTime, useAddCallTime, useAddTimeChoices,
  useSetTopUp, type HeldSeat, type LeftOwing, type SeatedPlayer, type SeatFailure,
} from './seats.ts';
export {
  isSeatAlert, useFloorRequests, useFloorRequestTargets, useFloorSignals, useReadyToSeat, type FloorRequest, type FloorRequestTargets,
  type SeatAlert,
} from './floorRequests.ts';
export { useFloorActions, useFloorUndo, useSeatCalled, type FloorUndo, type Seated } from './floorActions.ts';
export { useSeatEvents, useTabletSeats, type SeatEventFailure, type TabletPlayer, type TabletSeat } from './tabletSeats.ts';
export {
  isTopUpWaiting, useTodaysPlayers, useTopUpsTonight, type TodayStatus, type TodaysPlayer, type TopUpStatus, type TopUpTonight,
} from './floorToday.ts';
export { useStaffQueueCounts } from './staffQueues.ts';
export {
  useCorrectVisit, useDecideBonus, useWaitingBonusPage, type BonusChoice, type BonusDecision, type BonusDecisionFailure, type CorrectionDone, type SeatCorrection,
  type SessionCorrectionFailure, type VisitCorrection, type VisitTimes, type WaitingBonus, type WaitingSession, type WaitingVisit,
} from './bonusApprovals.ts';
export { DENSITIES, useSetStaffDensity, useSetStaffShortcuts, useStaffDensity, useStaffShortcuts, type Density } from './staffPreference.ts';
export {
  useTablesSetup, useTablesSetupActions, type SetupStake, type SetupTable, type StakeOrder, type TableGame,
  type TableOrder, type TablesFailure,
} from './tablesSetup.ts';
export { useFloorTakenSeats, useSeatCallActions } from './seatCall.ts';
export { useMyUsualFnbItems } from './fnbUsual.ts';
export { useMyNextPlayTimeBonus, useMySeat, useMySeatActions, type Leaving, type NextPlayTimeBonus, type MySeat, type MySeatFailure, type TopUp } from './mySeat.ts';
export { useFloorNight, useTableHands, type FloorNight, type TableHand, type TableNight } from './floorNight.ts';
export {
  isMemberQuery, MATCHES_MOST, topMatches, useMemberActions, useMemberEarlyDepartures, useMemberAccountStatuses, type MemberAccountState, type MemberAccountStatus, useMemberVisits, type MemberVisit, useMemberHoursPlayed, useMemberRecord, useMemberSearch, useVenueTiers, useWithdrawEarlyDeparture, type EarlyDeparture, type EarlyDepartureFailure, type MemberFailure, type MemberTierFailure, type MemberKycStatus, type MemberListRow,
  type MemberRecord, type MemberRow, type TierChange, type VenueTier,
} from './members.ts';
export type { MemberExportDetails } from './memberDetails.ts';
export {
  MEMBERS_PAGE, useEveryMember, useMemberChoices, useMembersPage, type MemberChoiceColumn, type MemberChoices, type MembersPage, type MembersView,
} from './membersList.ts';
export { useMemberSignUp, type MemberSignUp, type SignUpCampaign } from './memberSignUp.ts';
export { useResetMemberHours, type ResetHoursFailure } from './memberHours.ts';
export { useChangeMemberPhone, type PhoneChangeFailure } from './memberPhone.ts';
export { TOP_UP_HISTORY_PAGE, useTopUpHistory, type PastTopUp, type TopUpHistoryPage } from './topUpHistory.ts';
export {
  useEraseMember, useMemberErasurePreview, useMemberErasureRequests, useMyErasureRequest, useRemoveErasedKycFiles, useRequestMyErasure, type Erasure,
  type ErasureBlocker, type ErasureFailure, type ErasurePreview, type ErasureRequest,
} from './memberErasure.ts';
export {
  useApproveWaitlistRequest,
  useFloorTables,
  useFloorWaitlistActions,
  type FloorWaitlistWho,
  useMyWaitlist,
  useWaitlistActions,
  useWaitlistBoard, useWaitlistPage,
  useWaitlistRequests,
  type FloorTable,
  type WaitlistBoardEntry,
  type WaitlistFailure,
  type WaitlistPlace,
  type WaitlistRequest,
} from './waitlist.ts';
export {
  useDealerTablets,
  useDeviceActions,
  useMyDevice,
  usePairDevice,
  type DealerTablet,
  type DeviceFailure,
  type MyDevice,
  type PairFailure,
  type PairingCode,
} from './devices.ts';
export {
  useMyTvScreen,
  useTvActions,
  useTvPairing,
  useTvPairingActions,
  useTvPairingPolicy,
  useVenueTvs,
  type MyTvScreen,
  type TvBoardTurn,
  type TvCode,
  type TvFailure,
  type TvPairing,
  type TvPairingPolicy,
  type VenueTv,
} from './tvScreens.ts';
export {
  useTvCallTimeBoard, useTvLeaderboard, useTvNotice, useTvSignals, useTvWaitlistBoard, type TvCallTimeTable, type TvLeaderboardRow, type TvPlace,
  type TvSeated, type TvTableList,
} from './tvBoards.ts';
export { fetchClubContact, NO_CLUB_CONTACT, useClubContact, type ClubContact } from './clubContact.ts';
export { useMyPromotionCards, type PromotionCardData } from './promotionCards.ts';
export { useTvPromotions } from './tvPromotions.ts';
export {
  useCurrentDown,
  useDownActions,
  useSetDealerPin,
  useTabletDealers,
  useVenueDealers,
  type CurrentDown,
  type DealerPinFailure,
  type DownCount,
  type DealerSignInFailure,
  type EndDownFailure,
  type TabletDealer,
  type VenueDealer,
} from './dealerDowns.ts';
export { useHandQueue, type HandQueueState, type QueuedHand } from './handQueue.ts';
export {
  useTableRules,
  type HandVariant,
  type TableRules,
} from './hands.ts';
export { usePromotionActions, usePromotionStakes, type PromotionFailure, type PromotionStake } from './promotions.ts';
export {
  approverViewOf, isListedIn, useMemberPromotionGrants, usePromotionsOverview, usePromotionVersions,
  type ApproverView, type MemberPromotionGrant, type PromotionOverview, type PromotionsOverview, type PromotionVersionView,
} from './promotionVersions.ts';
export {
  usePromotionVersionActions, type DraftToSave, type PromotionVersionFailure, type SavedDraft,
} from './promotionVersionActions.ts';
export { useLastWeekReplay, type SimulationRun } from './promotionReplay.ts';
export {
  toHighHandTonight, useHighHandLive, useHighHandTonight, useLogHighHand, useMyHighHand, type HighHandHit, type HighHandLive, type HighHandLog,
  type HighHandTonight, type LogHighHandFailure, type LogHighHandReason,
} from './highHand.ts';
export { toTvHighHand, useTvHighHand, type TvHighHand, type TvHighHandPayout } from './tvHighHand.ts';
export { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
export { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
export { queryKeys } from './queryKeys.ts';
export { HIDDEN, toFeatureAccess, toFeatureAccessMap, type FeatureAccess, type FeatureAccessRow } from './parse/featureAccess.ts';
export { useWaitlistCallActions } from './waitlistCalls.ts';
export {
  useSettingActions, useVenueSettings, type SettingChange, type SettingEntry, type SettingFailure, type SettingField, type SettingSubjectRules,
  type SettingValue, type VenueSetting, type VenueSettings,
} from './settings.ts';
// Tournaments, interest only (redesign RD-26): Home's list and Notify me, and the console's screen.
export {
  useMyUpcomingTournaments, useRegisterTournamentInterest, useTournamentActions, useTournamentInterested, useVenueTournaments,
  type InterestedMember, type NewTournament, type TournamentFailure, type TournamentStanding, type UpcomingTournament, type VenueTournament,
} from './tournaments.ts';
export { useTableMetrics, useTableMetricsTotal, type TableMetrics, type TableMetricsTotal } from './tableMetrics.ts';
export {
  useBonusReport, useFnbReport, usePlayersReport, usePlayerVisitsPage, scopedTo, type PlayerVisit, useBonusGivenPage, type BonusGiven, type BonusSource, bonusSourceOf, useReportChart, useReportFigures, useWaitlistReport,
  type BonusLine, type ChartReport, type FigureReport, type FnbLine, type PlayersLine, type ReportBar, type ReportFigure, type ReportSpan, type WaitlistLine,
} from './clubReports.ts';
export { useContentBonusLine, useSaveContentBonusLine, type BonusLineFailure } from './bonusLine.ts';
