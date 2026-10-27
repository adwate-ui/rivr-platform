import { join } from 'node:path';
import { createAgentApi } from './api.ts';
import { enrol, readToken } from './enrol.ts';
import { syncPack } from './pack.ts';

const HOUR = 60 * 60 * 1000;

/** What the agent runs with: its settings, the network, a clock to repeat on, and somewhere to say what it did. */
export interface CliDeps {
  env: Readonly<Record<string, string | undefined>>;
  send: typeof fetch;
  every: (task: () => void, ms: number) => void;
  say: (line: string) => void;
}

function setting(deps: CliDeps, name: string): string {
  const value = deps.env[name] ?? '';
  if (value === '') throw new Error(`Set ${name}.`);
  return value;
}

async function runEnrol(deps: CliDeps, code: string | undefined): Promise<void> {
  if (code === undefined || !/^\d{6}$/.test(code)) throw new Error('Give the six-digit code from the Computers screen.');
  const api = createAgentApi(setting(deps, 'RIVR_FUNCTIONS_URL'), deps.send);
  const outcome = await enrol(api, setting(deps, 'RIVR_AGENT_HOME'), code);
  deps.say('deviceId' in outcome ? `Enrolled as ${outcome.deviceId}.` : `Not enrolled: ${outcome.refusal}.`);
}

async function runForever(deps: CliDeps): Promise<void> {
  const home = setting(deps, 'RIVR_AGENT_HOME');
  const api = createAgentApi(setting(deps, 'RIVR_FUNCTIONS_URL'), deps.send);
  const token = await readToken(home);
  if (token === null) throw new Error('Not enrolled yet: run enrol with the code from the Computers screen.');
  const syncOnce = async () => {
    try {
      deps.say(`Offline pack: ${JSON.stringify(await syncPack(api, token, join(home, 'offline-pack'), deps.send))}`);
    } catch (error) {
      // A lost connection is tried again within the hour; the packs already here stay.
      deps.say(`Offline pack not fetched: ${String(error)}`);
    }
  };
  await syncOnce();
  deps.every(() => void syncOnce(), HOUR);
}

/**
 * The agent's commands (#168, #123; decision 0260): `enrol <code>` claims the six-digit code staff read from the
 * Computers screen; `run` keeps the newest offline pack in RIVR_AGENT_HOME/offline-pack, checking every hour.
 */
export async function runCli(argv: readonly string[], deps: CliDeps): Promise<void> {
  const [command, argument] = argv;
  if (command === 'enrol') return runEnrol(deps, argument);
  if (command === 'run') return runForever(deps);
  throw new Error('Use enrol <code> or run.');
}
