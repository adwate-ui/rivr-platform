/**
 * Exports (#102; additions flow 20; decision 0190). Tara Menon, an admin, lists every member of the Member
 * tier and exports the table as CSV: the file holds the rows shown, each of that tier, and the audit log
 * records who, what, the filter and the row count. The record, the
 * large-export alert and who may are proved in supabase/tests/122_table_exports.test.sql. Local stack only:
 * it reads the audit log in the local database.
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

test.describe('Export', () => {
  test('Export: an admin exports the members of a tier as CSV, and the audit log records it', async ({ page }) => {
    test.skip(isRemoteTarget(), 'reads the audit log in the local database, so the local stack only');
    await signInToConsole(page, '9000000610');
    await page.getByRole('link', { name: 'Members' }).click();
    await page.getByRole('group', { name: 'Tier' }).getByRole('button', { name: 'Member', exact: true }).click();
    const members = page.getByRole('table', { name: 'Members' });
    await expect(members).toBeVisible();
    const shown = await members.getByRole('row').count() - 1;
    expect(shown).toBeGreaterThan(0);

    const saved = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await saved;
    expect(file.suggestedFilename()).toMatch(/^members-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await readFile(await file.path(), 'utf8');
    // The byte-order mark first, so a spreadsheet reads the file as UTF-8.
    expect(text.startsWith('\uFEFF')).toBe(true);
    const lines = text.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe('"No.","Member","Tier","Visits","Last visit"');
    expect(lines).toHaveLength(shown + 1);
    // Each row is of the tier chosen: its Tier cell, quoted, between the name and the visits.
    expect(lines.slice(1).every((line) => line.includes(',"Member",'))).toBe(true);

    const recorded = sql(`select after::text from public.audit_log where action = 'export.table' and entity_id = 'Members'
      and actor_user_id = '00000000-0000-4000-8000-000000000610' order by id desc limit 1`);
    expect(JSON.parse(recorded)).toEqual({ format: 'csv', filter: 'Tier: Member', rows: shown });
  });

  // #103 (decision 0232): Rhea Kapur, this flow's own super admin, makes the club's full archive, then Arjun
  // Mehta's data for an access request. Each file is locked to the owner's backup key (the seed's test key on a
  // local stack), and the audit log records each table's rows. What is in an archive is proved in
  // apps/console/src/features/admin/components/archive.test.ts and supabase/tests/133_export_archive.test.sql.
  test('Export: a super admin makes the club\'s archive and one member\'s, each locked to the owner\'s key, and the audit log records them', async ({ page }) => {
    test.skip(isRemoteTarget(), 'reads the audit log in the local database, so the local stack only');
    await signInToConsole(page, '9000000182');
    await page.getByRole('link', { name: 'Exports' }).click();

    const archive = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Make the archive' }).click();
    const file = await archive;
    expect(file.suggestedFilename()).toMatch(/^rivr-archive-\d{4}-\d{2}-\d{2}\.zip\.age$/);
    // An age file, locked to one X25519 key.
    expect((await readFile(await file.path())).subarray(0, 32).toString('latin1')).toMatch(/^age-encryption\.org\/v1\n-> X25519 /);
    await expect(page.getByText(/^Saved rivr-archive-.*\. Files: [\d,]+\.$/)).toBeVisible();
    const full = JSON.parse(sql(`select after::text from public.audit_log where action = 'export.archive'
      and actor_user_id = '00000000-0000-4000-8000-000000000182' order by id desc limit 1`));
    expect(full.tables).toBeGreaterThan(90);
    expect(full.counts.member).toBeGreaterThan(0);

    await page.getByRole('searchbox', { name: 'Find the member by name, mobile or member number' }).fill('Arjun Mehta');
    const member = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Export Arjun Mehta, No\. \d+$/ }).click();
    expect((await member).suggestedFilename()).toMatch(/^rivr-member-\d+-\d{4}-\d{2}-\d{2}\.zip\.age$/);
    const one = sql(`select entity_id || ' ' || (after -> 'counts' ->> 'member') from public.audit_log where action = 'export.member'
      and actor_user_id = '00000000-0000-4000-8000-000000000182' order by id desc limit 1`);
    expect(one).toBe('00000000-0000-4000-8000-000000000201 1');
  });
});
