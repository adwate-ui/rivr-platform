export { createRivrClient, SESSION_STORAGE_KEY, type RivrClient, type RivrClientOptions } from './client.ts';
export type { Database } from './database.types.ts';
export { RivrDataProvider, useAuthStatus, useRivrData, type AuthStatus } from './provider.tsx';
export { useMember, type Member } from './member.ts';
export { useControlState, useFeature, useFeatureStatus, type FeatureStatus } from './hooks.ts';
export { useSignIn, useSignOut, type SignInResult } from './signIn.ts';
// The website's reads are at @rivr/db/site, so the apps' bundles never carry their schemas.
export { StaffVenueProvider, useStaffVenue, useStaffVenues, type StaffVenue, type StaffVenueState } from './staff.tsx';
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
export { useCheckInActions, useDoorBoard, type CheckInFailure, type DoorMember } from './visits.ts';
export { useFloorSeats, useSeatActions, type SeatedPlayer, type SeatFailure } from './seats.ts';
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
export { useTvJackpot, useTvWaitlistBoard, type TvJackpot, type TvPlace, type TvStake } from './tvBoards.ts';
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
export { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
export { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
export { queryKeys } from './queryKeys.ts';
export { HIDDEN, toFeatureAccess, toFeatureAccessMap, type FeatureAccess, type FeatureAccessRow } from './parse/featureAccess.ts';
export { NOTHING_ENGAGED, toControlState, type ControlState, type KillableFeature } from './parse/controlState.ts';
export { useWaitlistCallActions } from './waitlistCalls.ts';
