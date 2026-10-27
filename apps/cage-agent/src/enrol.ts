import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentApi, AgentRefusal } from './api.ts';

const TOKEN_FILE = 'token';

/** The SHA-256 of a token, in hex, as the database keeps it. */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The agent's token, kept in its folder once it has enrolled; null before then. */
export async function readToken(home: string): Promise<string | null> {
  try {
    const token = (await readFile(join(home, TOKEN_FILE), 'utf8')).trim();
    return token === '' ? null : token;
  } catch {
    return null;
  }
}

/**
 * Enrols the agent with the code staff read from the Computers screen: makes a new token from 32 random bytes,
 * sends only its hash, and keeps the token in the agent's folder, readable by its own account alone.
 */
export async function enrol(api: AgentApi, home: string, code: string): Promise<{ deviceId: string } | { refusal: AgentRefusal }> {
  const token = randomBytes(32).toString('hex');
  const outcome = await api.enrol(code, tokenHash(token));
  if ('deviceId' in outcome) {
    await mkdir(home, { recursive: true });
    await writeFile(join(home, TOKEN_FILE), `${token}\n`, { mode: 0o600 });
  }
  return outcome;
}
