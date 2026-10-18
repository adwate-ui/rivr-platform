import type { Paise, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A product in the hosted accessories store. Checkout happens on the store's own page. */
export interface StoreProduct {
  readonly id: string;
  readonly name: string;
  readonly price: Paise;
  readonly imageUrl: string;
  /** The product's page in the hosted store, where the member buys it. */
  readonly productUrl: string;
  readonly isInStock: boolean;
}

/** The hosted accessories store embedded in the website. */
export interface StoreAdapter {
  /** Every product on sale. */
  listProducts(): Promise<Result<readonly StoreProduct[], AdapterFailure>>;
}
