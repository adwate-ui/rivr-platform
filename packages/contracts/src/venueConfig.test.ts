import { describe, expect, it } from 'vitest';
import { venueConfigSchema } from './venueConfig.ts';

const TYPED = {
  legalName: ' RIVR Gaming Pvt Ltd ', gstin: '06abcde1234f1z4', tan: ' delr12345e ', address: 'Golf Course Road, Gurugram', upiPayeeName: '', upiVpa: '',
  bankName: '', bankAccountName: '', bankAccountNumber: '', bankIfsc: '', invoicePrefix: 'rivr',
  alertWhatsapp: '98765 43210',
  contactPhone: '0124 400 0000', contactWhatsapp: '',
  sacClubServices: ' 999692 ', signatoryName: ' Rhea Kapoor ', signatoryDesignation: 'Partner',
  alertEmailOn: false, alertEmails: '',
};

describe('the venue configuration form (#33)', () => {
  it('reads empty optional fields as nothing, and capitals where the rules want them', () => {
    const parsed = venueConfigSchema.parse(TYPED);
    expect(parsed).toMatchObject({
      legalName: 'RIVR Gaming Pvt Ltd', gstin: '06ABCDE1234F1Z4', tan: 'DELR12345E', upiVpa: null, bankIfsc: null, invoicePrefix: 'RIVR',
      alertWhatsapp: '+919876543210',
      contactPhone: '+911244000000', contactWhatsapp: null,
      sacClubServices: '999692', signatoryName: 'Rhea Kapoor', signatoryDesignation: 'Partner',
    });
  });

  it('refuses what the database would: a bad GSTIN, a long prefix, no legal name', () => {
    for (const wrong of [
      { gstin: '06ABCDE1234F1Z' }, { invoicePrefix: 'RIVRGGN' },
      { legalName: ' ' }, { alertWhatsapp: '12345' }, { contactWhatsapp: '1244000000' }, { contactPhone: '87965' }, { sacClubServices: '99969' }, { sacClubServices: 'SAC999' },
    ]) {
      expect(venueConfigSchema.safeParse({ ...TYPED, ...wrong }).success).toBe(false);
    }
  });

  it('takes up to five alert email addresses, one a line or by commas, each once, and one at least while email alerts are on', () => {
    expect(venueConfigSchema.parse({ ...TYPED, alertEmailOn: true, alertEmails: ' Owner@Rivr.in \n\ngm@rivr.in, owner@rivr.in ' }))
      .toMatchObject({ alertEmailOn: true, alertEmails: ['owner@rivr.in', 'gm@rivr.in'] });
    for (const wrong of [{ alertEmailOn: true, alertEmails: ' ' }, { alertEmails: 'not an address' }, { alertEmails: 'a@x.in,b@x.in,c@x.in,d@x.in,e@x.in,f@x.in' }]) {
      expect(venueConfigSchema.safeParse({ ...TYPED, ...wrong }).success).toBe(false);
    }
  });

  // Decision 0582: the club's numbers, a landline to call and a mobile to WhatsApp, as +91 and ten digits.
  it('takes the club’s numbers with or without +91, a landline to call and a mobile to WhatsApp', () => {
    expect(venueConfigSchema.parse({ ...TYPED, contactPhone: '124 400 0000', contactWhatsapp: '+91 87965-80435' }))
      .toMatchObject({ contactPhone: '+911244000000', contactWhatsapp: '+918796580435' });
  });
});
