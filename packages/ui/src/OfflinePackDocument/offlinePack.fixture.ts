import type { OfflinePack } from './OfflinePackDocument.tsx';

/** A night's pack for the stories and tests: a table, a waitlist, two balances, three contacts and an SOP. */
export const PACK: OfflinePack = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018', gstin: '06AAAAA0000A1Z5' },
  venueName: 'RIVR Gurugram',
  generatedAt: '2026-11-15T11:30:00Z',
  contacts: [
    { kind: 'escalation', name: 'Vikram Sethi', role: 'Owner', phone: '+91 98100 00001', note: null },
    { kind: 'glaza', name: 'Glaza front desk', role: null, phone: '+91 124 400 0000', note: 'Ask for the duty manager' },
    { kind: 'electricity', name: 'DHBVN complaints', role: null, phone: '1912', note: null },
  ],
  balances: [
    { name: 'Mihir Shah', memberNumber: '1042', walletPaise: 2_500_000n, markersPaise: 0n },
    { name: 'Yash Gupta', memberNumber: '1043', walletPaise: 0n, markersPaise: 5_000_000n },
  ],
  walletsPaise: 2_500_000n,
  markersPaise: 5_000_000n,
  chipsInPlayPaise: 48_600_000n,
  cageFloatPaise: 20_000_000n,
  tables: [
    { name: 'Table 3', game: 'NLH 100/200', seats: [{ seat: 2, name: 'Mihir Shah', memberNumber: '1042' }, { seat: 4, name: 'Yash Gupta', memberNumber: '1043' }] },
  ],
  waitlist: [{ game: 'NLH 100/200', place: 1, name: 'Ritika Das', memberNumber: '1051' }],
  sops: [{ title: 'Cash-out during an outage', version: 2, inForceFrom: '2026-11-01', body: 'Count the chips with the player.\nWrite the amount on the paper cash-out slip and have both sign it.' }],
};
