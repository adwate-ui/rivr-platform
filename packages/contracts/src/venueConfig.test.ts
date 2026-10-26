import { describe, expect, it } from 'vitest';
import { chipAddSchema, venueConfigSchema } from './venueConfig.ts';

const TYPED = {
  legalName: ' RIVR Gaming Pvt Ltd ', gstin: '06abcde1234f1z4', tan: ' delr12345e ', address: 'Golf Course Road, Gurugram', upiPayeeName: '', upiVpa: '',
  bankName: '', bankAccountName: '', bankAccountNumber: '', bankIfsc: '', invoicePrefix: 'rivr',
  staffIpAllowlist: '203.0.113.0/24, 198.51.100.7  2001:db8::/32', alertWhatsapp: '98765 43210',
};

describe('the venue configuration form (#33)', () => {
  it('reads empty optional fields as nothing, capitals where the rules want them, and the networks as a list', () => {
    const parsed = venueConfigSchema.parse(TYPED);
    expect(parsed).toMatchObject({
      legalName: 'RIVR Gaming Pvt Ltd', gstin: '06ABCDE1234F1Z4', tan: 'DELR12345E', upiVpa: null, bankIfsc: null, invoicePrefix: 'RIVR',
      staffIpAllowlist: ['203.0.113.0/24', '198.51.100.7', '2001:db8::/32'], alertWhatsapp: '+919876543210',
    });
    expect(venueConfigSchema.parse({ ...TYPED, staffIpAllowlist: '  ' }).staffIpAllowlist).toEqual([]);
  });

  it('refuses what the database would: a bad GSTIN, a long prefix, a network that is not one or not its range\'s start, no legal name', () => {
    for (const wrong of [
      { gstin: '06ABCDE1234F1Z' }, { invoicePrefix: 'RIVRGGN' }, { staffIpAllowlist: '203.0.113.0/40' }, { staffIpAllowlist: '203.0.113.5/24' },
      { legalName: ' ' }, { alertWhatsapp: '12345' },
    ]) {
      expect(venueConfigSchema.safeParse({ ...TYPED, ...wrong }).success).toBe(false);
    }
  });

  it('takes a chip in whole rupees, a multiple of ₹50, with a name', () => {
    expect(chipAddSchema.safeParse({ rupees: '2000', name: '₹2,000' }).success).toBe(true);
    for (const rupees of ['75', '0', '50.5', '2000000']) expect(chipAddSchema.safeParse({ rupees, name: 'x' }).success).toBe(false);
    expect(chipAddSchema.safeParse({ rupees: '100', name: '' }).success).toBe(false);
  });
});
