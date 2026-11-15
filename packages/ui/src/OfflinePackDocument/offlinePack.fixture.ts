import type { OfflinePack } from './OfflinePackDocument.tsx';

/** A night's pack for the stories and tests: a table, a waitlist and three contacts. */
export const PACK: OfflinePack = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018', gstin: '06AAAAA0000A1Z5' },
  venueName: 'RIVR Gurugram',
  generatedAt: '2026-11-15T11:30:00Z',
  contacts: [
    { kind: 'escalation', name: 'Vikram Sethi', role: 'Owner', phone: '+91 98100 00001', note: null },
    { kind: 'glaza', name: 'Glaza front desk', role: null, phone: '+91 124 400 0000', note: 'Ask for the duty manager' },
    { kind: 'electricity', name: 'DHBVN complaints', role: null, phone: '1912', note: null },
  ],
  tables: [
    { name: 'Table 3', game: 'NLH 100/200', seats: [{ seat: 2, name: 'Mihir Shah', memberNumber: '1042' }, { seat: 4, name: 'Yash Gupta', memberNumber: '1043' }] },
  ],
  waitlist: [{ table: 'Table 3', game: 'NLH 100/200', place: 1, name: 'Ritika Das', memberNumber: '1051' }],
};
