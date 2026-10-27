/**
 * The RIVR cage agent (#168, #123; decision 0260), run with Node 22 as a Windows service on the cage computer:
 * `node rivr-agent.mjs enrol <code>`, then `node rivr-agent.mjs run`. RIVR_FUNCTIONS_URL is the project's functions
 * address, RIVR_AGENT_HOME the agent's folder. docs/runbooks/cage-agent.md installs it.
 */
import { runCli } from './cli.ts';

await runCli(process.argv.slice(2), {
  env: process.env,
  send: fetch,
  every: (task, ms) => setInterval(task, ms),
  say: (line) => process.stdout.write(`${new Date().toISOString()} ${line}\n`),
});
