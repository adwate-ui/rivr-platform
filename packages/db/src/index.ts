export { createRivrClient, type RivrClient, type RivrClientOptions } from './client.ts';
export type { Database } from './database.types.ts';
export { RivrDataProvider, useAuthStatus, useRivrData, type AuthStatus } from './provider.tsx';
export { useMember, type Member } from './member.ts';
export { useControlState, useFeature } from './hooks.ts';
export { useSignIn, type SignInResult } from './signIn.ts';
export { KYC_IMAGE_URL_SECONDS, useKycImageUrl } from './kycImages.ts';
export { useKycActions, useKycRecord, type KycRecord, type KycStatus } from './kyc.ts';
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
export { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
export { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
export { queryKeys } from './queryKeys.ts';
export { HIDDEN, toFeatureAccess, toFeatureAccessMap, type FeatureAccess, type FeatureAccessRow } from './parse/featureAccess.ts';
export { NOTHING_ENGAGED, toControlState, type ControlState, type KillableFeature } from './parse/controlState.ts';
