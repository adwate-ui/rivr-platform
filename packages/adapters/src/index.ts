// The registry and shared types. Each vendor's interface and fake are also importable on their
// own: `@rivr/adapters/upi-payouts`, `@rivr/adapters/kyc` and so on.
export {
  createAdapters,
  createFakeAdapters,
  type Adapters,
  type CreateAdaptersOptions,
  type LiveAdapters,
} from './registry.ts';
export type { AdapterFailure, PrinterFailure } from './shared/failure.ts';
export type { FakeControls } from './shared/recorder.ts';
export * from './cache-purge/index.ts';
export * from './cctv/index.ts';
export * from './channel-analytics/index.ts';
export * from './google-ads/index.ts';
export * from './instagram-graph/index.ts';
export * from './kitchen-printer/index.ts';
export * from './kyc/index.ts';
export * from './meta-conversions/index.ts';
export * from './push/index.ts';
export * from './receipt-printer/index.ts';
export * from './sms-otp/index.ts';
export * from './social-inbox/index.ts';
export * from './social-publishing/index.ts';
export * from './store/index.ts';
export * from './upi-payouts/index.ts';
export * from './whatsapp/index.ts';
