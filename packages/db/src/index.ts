export { createRivrClient, SESSION_STORAGE_KEY, type RivrClient, type RivrClientOptions } from './client.ts';
export type { Database } from './database.types.ts';
export { RivrDataProvider, useAuthStatus, useRivrData, type AuthStatus } from './provider.tsx';
export { useMember, type Member } from './member.ts';
export { useMembershipCard, type MembershipCardView } from './membershipCard.ts';
export { useControlState, useFeature, useFeatureStatus, type FeatureStatus } from './hooks.ts';
export { useSignIn, useSignOut, type SignInResult } from './signIn.ts';
// The website's reads are at @rivr/db/site, so the apps' bundles never carry their schemas.
// Lane A's money hooks (cage, credit, treasury, expenses...) are listed in money.ts, so lanes rarely edit the same list.
export * from './money.ts';
export { StaffVenueProvider, useStaffVenue, useStaffVenues, type StaffVenue, type StaffVenueState } from './staff.tsx';
export { useStaffActions, useVenueStaff, type StaffChange, type StaffFailure, type StaffMember } from './venueStaff.ts';
export {
  cellKey, useTierActions, useTierMatrix,
  type DisplayMode, type ShowsAs, type TierCell, type TierCellChange, type TierFailure, type TierMatrix,
} from './tierMatrix.ts';
export { useSignUp, type SignUpFailure } from './signUp.ts';
export { rememberAttribution, storedAttribution, type SignUpAttribution } from './attribution.ts';
export { KYC_IMAGE_URL_SECONDS, useKycImageUrl } from './kycImages.ts';
export { toBase64, useKycActions, useKycRecord, type KycRecord, type KycStatus } from './kyc.ts';
export { shrinkPhoto } from './photo.ts';
export {
  useKycInPerson,
  useKycInPersonCandidates,
  useKycReviewActions,
  useKycReviewQueue,
  type KycCandidate,
  type KycCheck,
  type KycDecision,
  type KycInPersonFailure,
  type KycInPersonOutcome,
  type KycRefusal,
  type KycReviewFailure,
  type KycWaitReason,
} from './kycReview.ts';
export {
  useAcademyActions,
  useAcademyBatches,
  useAcademyBookings,
  useAcademyInvoice,
  useAcademyPayment,
  type AcademyBatch,
  type AcademyBooking,
  type AcademyBookingStatus,
  type AcademyFailure,
  type AcademyInvoice,
  type AcademyPayment,
} from './academy.ts';
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
export { useCheckInActions, useCheckOutActions, useDoorBoard, type CheckInFailure, type CheckOutFailure, type CheckOutRefusal, type DoorMember } from './visits.ts';
export { useDoorScan, type DoorScan, type DoorScanFailure, type DoorScanRefusal } from './door.ts';
export {
  useFeedbackActions, useMyFeedbackVisit, useResolveFeedback, useVenueFeedback, type FeedbackFailure, type FeedbackItem, type FeedbackVisit,
} from './feedback.ts';
export * from './rewards.ts';
export * from './league.ts';
export * from './floorReports.ts';
export {
  useFloorSeats, useHeldSeats, useLeftOwingCallTime, useSeatActions, type HeldSeat, type LeftOwing, type SeatedPlayer, type SeatFailure,
} from './seats.ts';
export { useSeatEvents, useTabletSeats, type SeatEventFailure, type TabletPlayer, type TabletSeat } from './tabletSeats.ts';
export { useMySeat, type MySeat } from './mySeat.ts';
export { useFloorNight, useTableHands, type FloorNight, type TableHand, type TableNight } from './floorNight.ts';
export {
  isMemberQuery, useMemberActions, useMemberEarlyDepartures, useMemberRecord, useMembersOfTier, useMemberSearch, useVenueTiers, type EarlyDeparture, type MemberFailure,
  type MemberRecord, type MemberRow, type TierChange, type VenueTier,
} from './members.ts';
export {
  useEraseMember, useMemberErasurePreview, useRemoveErasedKycFiles, type Erasure, type ErasureBlocker, type ErasureFailure, type ErasurePreview,
} from './memberErasure.ts';
export {
  useFloorTables,
  useFloorWaitlistActions,
  useMyWaitlist,
  useWaitlistActions,
  useWaitlistBoard,
  type FloorTable,
  type WaitlistBoardEntry,
  type WaitlistFailure,
  type WaitlistPlace,
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
  useVenueTvs,
  type MyTvScreen,
  type TvCode,
  type TvFailure,
  type TvPairing,
  type VenueTv,
} from './tvScreens.ts';
export {
  useTvCallTimeBoard, useTvJackpot, useTvSignals, useTvWaitlistBoard, type TvCallTimeTable, type TvJackpot, type TvPlace, type TvSeated, type TvStake,
} from './tvBoards.ts';
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
  type TabletDealer,
  type VenueDealer,
} from './dealerDowns.ts';
export { useHandQueue, type HandQueueState, type QueuedClaim, type QueuedHand } from './handQueue.ts';
export {
  useDownHands,
  useTableRules,
  type DownHand,
  type HandVariant,
  type TableRules,
} from './hands.ts';
export {
  usePromotionActions, usePromotions, usePromotionStakes, usePromotionTemplates, type ConsolePromotion, type PromotionFailure, type PromotionStake,
  type PromotionToPublish,
} from './promotions.ts';
export { useOnboardingChecklist, type OnboardingItem } from './onboarding.ts';
export { useQuizAttempts, useQuizzes, useSubmitQuiz, type Quiz, type QuizAttempt, type QuizFailure, type QuizResult } from './quizzes.ts';
export {
  useSopAcknowledgements, useSopActions, useSopLibrary, type Sop, type SopAcknowledgement, type SopFailure, type SopVersion, type SopVersionInput,
} from './sops.ts';
export { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
export { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
export { queryKeys } from './queryKeys.ts';
export { HIDDEN, toFeatureAccess, toFeatureAccessMap, type FeatureAccess, type FeatureAccessRow } from './parse/featureAccess.ts';
export { NOTHING_ENGAGED, toControlState, type ControlState, type KillableFeature } from './parse/controlState.ts';
export { useWaitlistCallActions } from './waitlistCalls.ts';
export { useMyTonight, type MyTonight, type NextTournament } from './tonight.ts';
export {
  useSettingActions, useVenueSettings, type SettingChange, type SettingEntry, type SettingFailure, type SettingField, type SettingSubjectRules,
  type SettingValue, type VenueSetting, type VenueSettings,
} from './settings.ts';
export { useContacts, useDrills, useIncidentActions, useIncidents, type Contact, type Drill, type Incident, type IncidentFailure } from './incidents.ts';
// Tournaments (#115, #119): the console's at their own files, Home's and the TV's clock in liveTournament.ts.
export {
  useTournamentActions, useTournamentClock, useVenueTournaments,
  type ClockChange, type NewTournament, type TournamentAddOn, type TournamentBounty, type TournamentFailure, type TournamentField, type VenueTournament,
} from './tournaments.ts';
export {
  useTournamentPayoutActions, useTournamentPayouts, type DealOrder, type TournamentPayout,
} from './tournamentPayouts.ts';
export {
  useTournamentBalance, useTournamentFloorActions, useTournamentSeating,
  type BalancePrompt, type EntryStatus, type FloorChange, type TournamentSeatRow,
} from './tournamentFloor.ts';
export type { BuyFailure, FinishFailure } from './tournamentFailures.ts';
export {
  useBlindStructures, useTournamentSetupActions, useTournamentTemplates, type BlindStructure, type TemplateOrder, type TournamentTemplate,
} from './tournamentSetup.ts';
export {
  useElapsedNow, useMyTournament, useRegisterTournamentEntry, useTvTournamentClock, type AppPurchase, type LiveField, type LiveTournament, type MyStanding,
  type MyTournament,
} from './liveTournament.ts';
