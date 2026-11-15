import { createFakeCachePurge, type CachePurgeAdapter } from './cache-purge/index.ts';
import { createFakeCctv, type CctvAdapter } from './cctv/index.ts';
import { createFakeGoogleAds, type GoogleAdsConversionsAdapter } from './google-ads/index.ts';
import { createFakeKitchenPrinter, type KitchenPrinterAdapter } from './kitchen-printer/index.ts';
import { createFakeKyc, createUnconfiguredKyc, type KycAdapter } from './kyc/index.ts';
import { createFakeLiveStatus, type LiveStatusAdapter } from './live-status/index.ts';
import { createFakeMetaConversions, type MetaConversionsAdapter } from './meta-conversions/index.ts';
import { createFakePush, type PushAdapter } from './push/index.ts';
import { createFakeSmsOtp, type SmsOtpAdapter } from './sms-otp/index.ts';
import { createFakeStore, type StoreAdapter } from './store/index.ts';
import { createFakeWhatsApp, type WhatsAppAdapter } from './whatsapp/index.ts';

/** Every vendor RIVR talks to, one adapter each. Outbox consumers take these and nothing else. */
export interface Adapters {
  readonly kyc: KycAdapter;
  readonly smsOtp: SmsOtpAdapter;
  readonly whatsapp: WhatsAppAdapter;
  readonly push: PushAdapter;
  readonly liveStatus: LiveStatusAdapter;
  readonly metaConversions: MetaConversionsAdapter;
  readonly googleAds: GoogleAdsConversionsAdapter;
  readonly cachePurge: CachePurgeAdapter;
  readonly store: StoreAdapter;
  readonly cctv: CctvAdapter;
  readonly kitchenPrinter: KitchenPrinterAdapter;
}

/** The live implementations whose credentials have arrived; leave the rest out. */
export type LiveAdapters = Partial<Adapters>;

/** Which venue the adapters serve, and the live implementations available to it. */
export interface CreateAdaptersOptions {
  readonly isPracticeVenue: boolean;
  readonly live: LiveAdapters;
}

/** A fake for every adapter, each with its call log and failure script. */
export function createFakeAdapters() {
  return {
    kyc: createFakeKyc(),
    smsOtp: createFakeSmsOtp(),
    whatsapp: createFakeWhatsApp(),
    push: createFakePush(),
    liveStatus: createFakeLiveStatus(),
    metaConversions: createFakeMetaConversions(),
    googleAds: createFakeGoogleAds(),
    cachePurge: createFakeCachePurge(),
    store: createFakeStore(),
    cctv: createFakeCctv(),
    kitchenPrinter: createFakeKitchenPrinter(),
  } satisfies Adapters;
}

function liveOr<Adapter>(live: Adapter | undefined, standIn: () => Adapter): Adapter {
  return live ?? standIn();
}

/**
 * The adapters for one venue. The practice venue always gets fakes, whatever is configured, so
 * nothing from it reaches a vendor. A real venue gets the live adapter where credentials exist;
 * otherwise the fake, except that KYC fails closed (identity is never faked).
 */
export function createAdapters({ isPracticeVenue, live }: CreateAdaptersOptions): Adapters {
  const fakes = createFakeAdapters();
  if (isPracticeVenue) return fakes;
  return {
    kyc: liveOr(live.kyc, createUnconfiguredKyc),
    smsOtp: liveOr(live.smsOtp, () => fakes.smsOtp),
    whatsapp: liveOr(live.whatsapp, () => fakes.whatsapp),
    push: liveOr(live.push, () => fakes.push),
    liveStatus: liveOr(live.liveStatus, () => fakes.liveStatus),
    metaConversions: liveOr(live.metaConversions, () => fakes.metaConversions),
    googleAds: liveOr(live.googleAds, () => fakes.googleAds),
    cachePurge: liveOr(live.cachePurge, () => fakes.cachePurge),
    store: liveOr(live.store, () => fakes.store),
    cctv: liveOr(live.cctv, () => fakes.cctv),
    kitchenPrinter: liveOr(live.kitchenPrinter, () => fakes.kitchenPrinter),
  };
}
