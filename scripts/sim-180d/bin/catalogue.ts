import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isLive, readCatalogue } from '../src/catalogue/catalogue.ts';
import { say } from '../src/log.ts';
import { SIM_HOME } from '../src/paths.ts';

const catalogue = await readCatalogue();
mkdirSync(SIM_HOME, { recursive: true });
const file = join(SIM_HOME, 'catalogue.json');
writeFileSync(file, `${JSON.stringify(catalogue, null, 2)}\n`);

if (process.argv.includes('--list')) {
  for (const screen of catalogue.screens) say(`${screen.app}\t${screen.kind}\t${screen.path}\t${screen.anyOf.join(',')}`);
}
const live = catalogue.screens.filter(isLive).length;
say(`${catalogue.screens.length} screens (${live} live), ${catalogue.rpcs.length} calls; written to ${file}`);
