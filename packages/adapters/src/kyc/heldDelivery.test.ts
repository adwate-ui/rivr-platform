import { describe, expect, it } from 'vitest';
import { DELIVERY_WAIT_MS, deliveryStep, heldDelivery } from './heldDelivery.ts';

// kyc_digilocker_delivery's answer for a made-up member, as jsonb comes back over PostgREST.
const STARTED = '2026-11-16T10:00:00+00:00';
const startedAt = Date.parse(STARTED);
const waiting = {
  started_at: STARTED, outcome: null, name: null, date_of_birth: null, masked_aadhaar: null, pan: null, address: null, photo: null,
  vendor_reference: null, refusal: null,
};
const fetched = {
  ...waiting, outcome: 'fetched', name: 'Asha Rani Verma', date_of_birth: '1991-03-07', masked_aadhaar: 'XXXX XXXX 4321', pan: 'ABCPV1234D',
  address: 'Sector 65, Gurugram', photo: 'data:image/jpeg;base64,/9j/4AAQ', vendor_reference: '65f0a1b2c3d4e5f6a7b8c9d0',
};

describe('a held DigiLocker delivery', () => {
  it('is none when the member has no session held', () => {
    expect(heldDelivery(null)).toBeNull();
    expect(heldDelivery('not a row')).toBeNull();
  });

  it('gives the record that came, as the check keeps it', () => {
    expect(heldDelivery(fetched)).toEqual({
      startedAt,
      record: {
        name: 'Asha Rani Verma', dateOfBirth: '1991-03-07', maskedAadhaar: 'XXXX XXXX 4321', aadhaarReference: null, pan: 'ABCPV1234D',
        address: 'Sector 65, Gurugram', photoUrl: 'data:image/jpeg;base64,/9j/4AAQ', vendorReference: '65f0a1b2c3d4e5f6a7b8c9d0',
      },
      refusal: null,
    });
  });

  it('keeps no date of birth or PAN it was not given', () => {
    expect(heldDelivery({ ...fetched, date_of_birth: null, pan: null })?.record).toMatchObject({ dateOfBirth: null, pan: null });
  });

  it('has no record from a fetched delivery missing what the check needs', () => {
    expect(heldDelivery({ ...fetched, photo: null })?.record).toBeNull();
  });

  it('gives why none came', () => {
    expect(heldDelivery({ ...waiting, outcome: 'refused', refusal: 'Zoop CSD' })?.refusal).toBe('Zoop CSD');
    expect(heldDelivery({ ...waiting, outcome: 'refused' })?.refusal).toBe('rejected');
  });
});

describe('the complete step\'s next move', () => {
  it('takes the record, or keeps the refusal, whenever the member is back', () => {
    const late = startedAt + DELIVERY_WAIT_MS + 1;
    expect(deliveryStep(heldDelivery(fetched), late, true)).toMatchObject({ kind: 'record' });
    expect(deliveryStep(heldDelivery({ ...waiting, outcome: 'refused', refusal: 'Zoop CSD' }), late, true)).toEqual({ kind: 'refused', reason: 'Zoop CSD' });
  });

  it('asks the vendor while nothing has come in Zoop\'s half hour, and gives up after', () => {
    expect(deliveryStep(heldDelivery(waiting), startedAt + 60_000, true)).toEqual({ kind: 'ask' });
    expect(deliveryStep(heldDelivery(waiting), startedAt + DELIVERY_WAIT_MS, true)).toEqual({ kind: 'ask' });
    expect(deliveryStep(heldDelivery(waiting), startedAt + DELIVERY_WAIT_MS + 1, true)).toEqual({ kind: 'expired' });
  });

  it('gives up on a session whose start cannot be read', () => {
    expect(deliveryStep(heldDelivery({ ...waiting, started_at: 'soon' }), startedAt, true)).toEqual({ kind: 'expired' });
  });

  it('asks a vendor that hands the record over when there is no session held', () => {
    expect(deliveryStep(null, startedAt, false)).toEqual({ kind: 'ask' });
  });

  it('has nothing coming, and asks no one, when a webhook vendor has no session held', () => {
    expect(deliveryStep(null, startedAt, true)).toEqual({ kind: 'expired' });
  });
});
