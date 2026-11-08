/**
 * Real photos for the census. The simulation stores each selfie and desk photo as a storage row only (sql/03_people.sql),
 * so the apps' photos would fail to load where a member's would not. This uploads one made-up portrait for every such
 * row through the Storage API, with the local stack's own service-role key (never printed), before the browsers open.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SIM_HOME } from '../src/paths.ts';
import { sql } from './stack/psql.ts';
import { status } from './stack/supabase.ts';

const PORTRAIT = join(SIM_HOME, 'sample-portrait.jpg');
const AT_ONCE = 20;

// A plain made-up portrait at the selfie's 3:4: a head and shoulders on a soft background. No real person.
const PAGE = `<body style="margin:0"><div style="width:600px;height:800px;background:linear-gradient(#c9d6df,#8fa3b0);position:relative">
  <div style="position:absolute;left:180px;top:170px;width:240px;height:300px;border-radius:50%;background:#d9a77f"></div>
  <div style="position:absolute;left:90px;top:500px;width:420px;height:320px;border-radius:200px 200px 0 0;background:#2f4858"></div>
</div></body>`;

async function portrait(): Promise<Buffer> {
  if (existsSync(PORTRAIT)) return readFileSync(PORTRAIT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await page.setContent(PAGE);
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 80 });
  await browser.close();
  writeFileSync(PORTRAIT, jpeg);
  return jpeg;
}

/** Uploads the portrait for every KYC photo row that has no file; returns how many. */
export async function realPhotos(repoRoot: string): Promise<number> {
  const names = sql(`select name from storage.objects where bucket_id = 'kyc' and metadata is null`).split('\n').filter((name) => name !== '');
  if (names.length === 0) return 0;
  const jpeg = await portrait();
  const stack = status(repoRoot);
  for (let first = 0; first < names.length; first += AT_ONCE) {
    await Promise.all(names.slice(first, first + AT_ONCE).map(async (name) => {
      const answer = await fetch(`${stack.apiUrl}/storage/v1/object/kyc/${name}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${stack.serviceRoleKey}`, 'x-upsert': 'true', 'content-type': 'image/jpeg' },
        body: jpeg,
      });
      if (!answer.ok) throw new Error(`uploading ${name} answered ${String(answer.status)}`);
    }));
  }
  return names.length;
}
