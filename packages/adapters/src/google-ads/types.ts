import type { IdempotencyKey, IndianMobile, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** An offline conversion to import into Google Ads: a visit or booking that followed an ad. */
export interface OfflineConversion {
  /** Google drops a second upload with the same order id. */
  readonly orderId: IdempotencyKey;
  /** The conversion action's resource name, from venue configuration. */
  readonly conversionAction: string;
  readonly conversionTime: Date;
  /** The ad click id, when the member arrived from an ad click. */
  readonly gclid: string | null;
  readonly phone: IndianMobile;
}

/** The conversion exactly as Google receives it, with the phone hashed. */
export interface GoogleAdsClickConversion {
  readonly orderId: string;
  readonly conversionAction: string;
  /** `yyyy-mm-dd hh:mm:ss+00:00`. */
  readonly conversionDateTime: string;
  readonly gclid?: string;
  readonly userIdentifiers: readonly { readonly hashedPhoneNumber: string }[];
}

/** Google Ads offline conversion import. Enabled, not behind a flag (14 Oct additions). */
export interface GoogleAdsConversionsAdapter {
  /** Uploads one conversion. */
  upload(conversion: OfflineConversion): Promise<Result<{ readonly accepted: number }, AdapterFailure>>;
}
