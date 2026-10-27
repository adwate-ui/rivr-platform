// @vitest-environment node
import type { ArchivePage, ArchivePlan, ArchiveSource } from '@rivr/db/exports';
import { Decrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { describe, expect, it } from 'vitest';
import { archiveCell, archiveCsv, makeArchive } from './archive.ts';

describe('archiveCell', () => {
  it('writes a cell as COPY does: null empty, quoted only when it must be, and never changed', () => {
    expect(archiveCell(null)).toBe('');
    expect(archiveCell('')).toBe('""');
    expect(archiveCell('Arjun')).toBe('Arjun');
    expect(archiveCell('Mehta, Arjun')).toBe('"Mehta, Arjun"');
    expect(archiveCell('6" tall')).toBe('"6"" tall"');
    expect(archiveCell('two\nlines')).toBe('"two\nlines"');
    expect(archiveCell('=1+1')).toBe('=1+1');
  });

  it('writes a table with its header row', () => {
    expect(archiveCsv(['id', 'name'], [['1', 'Arjun'], ['2', null]])).toBe('id,name\n1,Arjun\n2,\n');
  });
});

const MEMBERS: ArchivePage['rows'] = [['m1', 'Arjun Mehta'], ['m2', 'Meera, Iyer'], ['m3', null]];
const KYC: ArchivePage['rows'] = [['k1', 'v/m1/photo.jpg'], ['k2', null], ['k3', 'v/m3/gone.jpg']];
const FILES = ['expense-receipts/v/e1.jpg', 'kyc/v/m1/photo.jpg', 'kyc/v/m3/gone.jpg'];

/** A source of two tables, two rows a page, as the database answers; it logs what is asked of it, in order. */
function fakeSource(recipient: string, start: () => Promise<void> = () => Promise.resolve()) {
  const log: string[] = [];
  const pages: Record<string, ArchivePage['rows']> = { member: MEMBERS, kyc_record: KYC };
  const plan = (kycReason: string | null): ArchivePlan => ({
    archiveId: 'a1', recipient, tables: [{ name: 'kyc_record', columns: ['id', 'photo_path'] }, { name: 'member', columns: ['id', 'full_name'] }],
    // As the server lists them: receipts always, KYC photos with a reason.
    files: FILES.filter((file) => kycReason !== null || !file.startsWith('kyc/')),
  });
  const source: ArchiveSource = {
    start: async (memberId, kycReason) => {
      log.push(`start ${memberId ?? 'venue'} ${kycReason ?? 'no photos'}`);
      await start();
      return plan(kycReason);
    },
    page: (archiveId, table, after) => {
      const from = typeof after === 'number' ? after : 0;
      log.push(`page ${archiveId} ${table} ${from}`);
      const rows = pages[table] ?? [];
      return Promise.resolve({ rows: rows.slice(from, from + 2), after: from + 2 < rows.length ? from + 2 : null });
    },
    complete: (archiveId, sha256, bytes, unread) => {
      log.push(`complete ${archiveId} ${sha256} ${bytes} ${unread.join(' ')}`);
      return Promise.resolve();
    },
    receipt: (path) => {
      log.push(`receipt ${path}`);
      return Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e]));
    },
    kycPhoto: (path) => {
      log.push(`photo ${path}`);
      return path.endsWith('gone.jpg') ? Promise.reject(new Error('HTTP 403')) : Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff]));
    },
  };
  return { source, log };
}

async function keyPair() {
  const identity = await generateX25519Identity();
  return { identity, recipient: await identityToRecipient(identity) };
}

async function opened(file: Uint8Array, identity: string): Promise<string> {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  // Stored, not compressed: each part's bytes are in the zip as they are.
  return new TextDecoder('latin1').decode(await decrypter.decrypt(file));
}

const REQUEST = { venueId: 'v', memberId: null, madeAt: new Date('2026-10-26T18:30:00Z') };

describe('makeArchive', () => {
  it('starts the archive (so the audit log has it) before reading every table a page at a time, and locks the zip to the owner\'s key', async () => {
    const { identity, recipient } = await keyPair();
    const { source, log } = fakeSource(recipient);
    const archive = await makeArchive(source, { ...REQUEST, kycReason: 'Police request, case 41 of 2026' }, () => undefined);

    expect(log).toEqual([
      'start venue Police request, case 41 of 2026',
      'page a1 kyc_record 0', 'page a1 kyc_record 2', 'page a1 member 0', 'page a1 member 2',
      'receipt v/e1.jpg', 'photo v/m1/photo.jpg', 'photo v/m3/gone.jpg',
    ]);
    expect(archive).toMatchObject({ tables: 2, rows: 6, files: 2, unread: ['kyc/v/m3/gone.jpg'] });
    const zip = await opened(archive.file, identity);
    expect(zip).toContain('tables/member.csv');
    expect(zip).toContain('id,full_name\nm1,Arjun Mehta\nm2,"Meera, Iyer"\nm3,\n');
    expect(zip).toContain('files/kyc/v/m1/photo.jpg');
    expect(zip).toContain('files/expense-receipts/v/e1.jpg');
    expect(zip).toContain('"files": 2');
    expect(zip).toContain('"files_unread": [\n    "kyc/v/m3/gone.jpg"\n  ]');
    expect(zip).toContain('"made_at": "2026-10-26T18:30:00.000Z"');
  });

  it('leaves the KYC photos out without a reason, keeping the receipts', async () => {
    const { recipient } = await keyPair();
    const { source, log } = fakeSource(recipient);
    const archive = await makeArchive(source, { ...REQUEST, kycReason: null }, () => undefined);
    expect(log[0]).toBe('start venue no photos');
    expect(log.some((line) => line.startsWith('photo'))).toBe(false);
    expect(log).toContain('receipt v/e1.jpg');
    expect(archive.files).toBe(1);
  });

  it('reads nothing when the start is refused', async () => {
    const { recipient } = await keyPair();
    const { source, log } = fakeSource(recipient, () => Promise.reject(Object.assign(new Error('refused'), { code: '42501' })));
    await expect(makeArchive(source, { ...REQUEST, kycReason: null }, () => undefined)).rejects.toThrow('refused');
    expect(log).toEqual(['start venue no photos']);
  });

  it('cannot be opened without the owner\'s key', async () => {
    const owner = await keyPair();
    const someoneElse = await keyPair();
    const { source } = fakeSource(owner.recipient);
    const archive = await makeArchive(source, { ...REQUEST, kycReason: null }, () => undefined);
    await expect(opened(archive.file, someoneElse.identity)).rejects.toThrow();
  });
});
