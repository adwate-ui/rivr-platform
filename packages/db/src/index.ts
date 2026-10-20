export { createRivrClient, SESSION_STORAGE_KEY, type RivrClient, type RivrClientOptions } from './client.ts';
export type { Database } from './database.types.ts';
export { RivrDataProvider, useAuthStatus, useRivrData, type AuthStatus } from './provider.tsx';
export { useMember, type Member } from './member.ts';
export { useMembershipCard, type MembershipCardView } from './membershipCard.ts';
export { useControlState, useFeature, useFeatureStatus, type FeatureStatus } from './hooks.ts';
export {
  useControlActions, useEngagedControls, type ControlFailure, type ControlLevel, type EngageOrder, type EngagedControl,
} from './killSwitch.ts';
export { useSignIn, useSignOut, type SignInResult } from './signIn.ts';
// The website's reads are at @rivr/db/site, so the apps' bundles never carry their schemas.
export { StaffVenueProvider, useStaffVenue, useStaffVenues, type StaffVenue, type StaffVenueState } from './staff.tsx';
export { useStaffActions, useVenueStaff, type StaffChange, type StaffFailure, type StaffMember } from './venueStaff.ts';
export {
  cellKey, useTierActions, useTierMatrix,
  type DisplayMode, type ShowsAs, type TierCell, type TierCellChange, type TierFailure, type TierMatrix,
} from './tierMatrix.ts';
export {
  useStaffAcademyActions,
  useStaffAcademyBatches,
  useStaffAcademyBookings,
  type AcademyStaffFailure,
  type StaffAcademyBatch,
  type StaffAcademyBooking,
} from './academyStaff.ts';
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
  useAcademyPayment,
  type AcademyBatch,
  type AcademyBooking,
  type AcademyBookingStatus,
  type AcademyFailure,
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
export {
  BREAK_DAYS,
  SESSION_REMINDERS,
  useRestrictionActions,
  useRestrictions,
  type BreakDays,
  type Restrictions,
  type SessionReminder,
} from './restrictions.ts';
export { useCheckInActions, useCheckOutActions, useDoorBoard, type CheckInFailure, type CheckOutFailure, type CheckOutRefusal, type DoorMember } from './visits.ts';
export {
  PAYOUT_STATUSES, usePayoutAccountActions, usePayoutAccountDecisions, usePayoutAccounts, usePayoutAccountsToVerify, type PayoutAccount,
  type PayoutAccountFailure, type PayoutAccountToVerify, type PayoutDecision, type PayoutStatus,
} from './payoutAccounts.ts';
export {
  useWaitingWithdrawals, useWithdrawalActions, useWithdrawalDecisions, useWithdrawals, type WaitingWithdrawal, type Withdrawal, type WithdrawalFailure,
  type WithdrawalOrder, type WithdrawalStatus,
} from './withdrawals.ts';
export {
  useDepositActions, useDepositDecisions, useDepositDetails, useDeposits, useWaitingDeposits, type Deposit, type DepositDetails, type DepositFailure,
  type DepositOrder, type DepositStatus, type WaitingDeposit,
} from './deposits.ts';
export {
  MOVEMENT_ACCOUNTS, MOVEMENT_KINDS, useWallet, useWalletMovements, type Movement, type MovementAccount, type MovementKind, type Wallet,
  type WalletBonus, type WalletMarker,
} from './wallet.ts';
export {
  useFloorSeats, useHeldSeats, useLeftOwingCallTime, useSeatActions, type HeldSeat, type LeftOwing, type SeatedPlayer, type SeatFailure,
} from './seats.ts';
export { useSeatEvents, useTabletSeats, type SeatEventFailure, type TabletPlayer, type TabletSeat } from './tabletSeats.ts';
export { useMySeat, type MySeat } from './mySeat.ts';
export { useFloorNight, useTableHands, type FloorNight, type TableHand, type TableNight } from './floorNight.ts';
export {
  useCageActions,
  useCageMembers,
  useCageQueue,
  type BuyInOrder,
  type CashOutDone,
  type CashOutOrder,
  type BuyInRequest,
  type CageFailure,
  type CageMember,
} from './cage.ts';
export { useCreditActions, useCreditLines, useCreditRoom, type CreditFailure, type CreditLine, type CreditRoom } from './credit.ts';
export {
  useChipInventory, useTreasury, useTreasuryActions, type CageShift, type ChipCount, type ChipCountLine, type ChipInventory, type Treasury,
  type TreasuryFailure,
} from './treasury.ts';
export {
  useEodActions, useEodCloses, type CloseFigure, type CloseOrder, type CloseReview, type EodClose, type EodFailure,
} from './eod.ts';
export { useShiftOpenings, type ShiftOpening } from './eod.ts';
export { useMarkerActions, useOpenMarkers, type MarkerFailure, type MarkerOrder, type OpenMarker } from './markers.ts';
export {
  isMemberQuery, useMemberActions, useMemberEarlyDepartures, useMemberRecord, useMemberSearch, useVenueTiers, type EarlyDeparture, type MemberFailure,
  type MemberRecord, type MemberRow, type TierChange, type VenueTier,
} from './members.ts';
export {
  useFeatureOverrideActions, useGateableFeatures, useMemberFeatureOverrides, type FeatureOverride, type GateableFeature, type OverrideFailure,
  type OverrideOrder,
} from './featureOverrides.ts';
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
export { useComputerActions, useComputers, useThisComputer, type Computer, type ComputerCode, type ComputerFailure, type ComputerKind, type ThisComputer } from './computers.ts';
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
export { useTvJackpot, useTvWaitlistBoard, type TvJackpot, type TvPlace, type TvStake } from './tvBoards.ts';
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
  useRakeChangeActions,
  useTableTypeRake,
  type RakeChange,
  type RakeChangeFailure,
  type RakeSetting,
  type TableTypeRake,
} from './rakeSettings.ts';
export {
  useJackpot,
  useJackpotActions,
  type BadBeat,
  type Jackpot,
  type JackpotEvent,
  type JackpotFailure,
} from './jackpots.ts';
export {
  useHighHandActions,
  useHighHands,
  useTabletHighHands,
  type HighHand,
  type HighHandFailure,
  type TabletHighHand,
} from './highHands.ts';
export {
  usePromotionActions, usePromotions, usePromotionStakes, usePromotionTemplates, type ConsolePromotion, type PromotionFailure, type PromotionStake,
  type PromotionToPublish,
} from './promotions.ts';
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
export {
  useSettingActions, useVenueSettings, type SettingChange, type SettingEntry, type SettingFailure, type SettingField, type SettingSubjectRules,
  type SettingValue, type VenueSetting, type VenueSettings,
} from './settings.ts';
export {
  useChipDenominations, useVenueConfig, useVenueConfigActions, type ChipDenomination, type VenueConfig, type VenueConfigFailure,
  useVenueIssuer,
  type VenueIssuer,
} from './venueConfig.ts';
export { useContacts, useDrills, useIncidentActions, useIncidents, type Contact, type Drill, type Incident, type IncidentFailure } from './incidents.ts';
