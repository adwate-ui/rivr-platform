import { paiseSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeStore, type StoreProduct } from './index.ts';

const cap: StoreProduct = {
  id: 'cap',
  name: 'RIVR cap',
  price: paiseSchema.parse(150_000n),
  imageUrl: 'https://store.rivr.test/cap.jpg',
  productUrl: 'https://store.rivr.test/cap',
  isInStock: true,
};

describe('fake store', () => {
  it('sells nothing unless a test stocks it, so no invented product reaches the website', async () => {
    expect(await createFakeStore().listProducts()).toEqual({ ok: true, value: [] });
  });

  it('lists the products it was given', async () => {
    const store = createFakeStore({ products: [cap] });

    expect(await store.listProducts()).toEqual({ ok: true, value: [cap] });
    expect(store.calls).toHaveLength(1);
  });

  it('fails the next call when a test scripts it', async () => {
    const store = createFakeStore();
    store.failNext({ code: 'unavailable' });

    expect(await store.listProducts()).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
