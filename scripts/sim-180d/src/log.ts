/** Prints one line. The shared lint config bans console, so command-line tools write to stdout, as scripts/verify.mjs does. */
export function say(line: string): void {
  process.stdout.write(`${line}\n`);
}
