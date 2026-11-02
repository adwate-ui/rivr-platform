import { useGiveLeaguePoints, type LeagueGiveFailure } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, CameraButton, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { parseLeagueCsv, type LeagueCsv, type LeagueCsvProblem } from '../leagueCsv.ts';

// A long file's problems are shown ten at a time: fix those, choose it again, and the next ones show.
const PROBLEMS_SHOWN = 10;
// 500 members and their points fit in a few kilobytes: a larger file is not this one, and is never read.
const MOST_BYTES = 1_048_576;

function problemText(problem: LeagueCsvProblem): string {
  if (problem.kind === 'badLine') return t('console.rewards.leagueCsv.badLine', { line: formatNumber(problem.line) });
  if (problem.kind === 'twice') return t('console.rewards.leagueCsv.twice', { line: formatNumber(problem.line), number: String(problem.number) });
  return t(`console.rewards.leagueCsv.${problem.kind}`);
}

const failureText = (failure: LeagueGiveFailure) =>
  failure.kind === 'no_member'
    ? t('console.rewards.leagueCsv.failures.no_member', { numbers: failure.numbers })
    : t(`console.rewards.leagueCsv.failures.${failure.kind}`);

/** A file chosen and read, with the request id that gives it once, kept until it is given or another is chosen. */
interface Chosen {
  readonly csv: LeagueCsv;
  readonly requestId: string;
}

/** What the file holds, or what is wrong with it, line by line. */
function FileSummary({ chosen }: { chosen: Chosen }) {
  const { rows, problems } = chosen.csv;
  if (problems.length > 0) {
    const more = problems.length - PROBLEMS_SHOWN;
    return (
      <Stack gap={2}>
        {problems.slice(0, PROBLEMS_SHOWN).map((problem) => <ErrorMessage key={JSON.stringify(problem)}>{problemText(problem)}</ErrorMessage>)}
        {more > 0 ? <Text variant="small" tone="muted">{t('console.rewards.leagueCsv.more', { count: formatNumber(more) })}</Text> : null}
      </Stack>
    );
  }
  const points = rows.reduce((sum, row) => sum + row.points, 0n);
  // Said as it appears, so a screen reader hears the file is ready before Give shows.
  const summary = rows.length === 1 ? 'console.rewards.leagueCsv.summaryOne' : 'console.rewards.leagueCsv.summary';
  return <StatusMessage>{t(summary, { members: formatNumber(rows.length), points: formatNumber(points) })}</StatusMessage>;
}

/** The reason and Give, for a file with no problems; what came of it. */
function GiveFile({ venueId, chosen, onGiven }: { venueId: string; chosen: Chosen; onGiven: (text: string) => void }) {
  const give = useGiveLeaguePoints(venueId);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<LeagueGiveFailure | null>(null);
  const send = async () => {
    setFailure(null);
    const done = await give.mutateAsync({ rows: chosen.csv.rows, reason, requestId: chosen.requestId });
    const given = done.ok && done.value.members === 1 ? 'console.rewards.leagueCsv.doneOne' : 'console.rewards.leagueCsv.done';
    if (done.ok) onGiven(t(given, { points: formatNumber(done.value.points), members: formatNumber(done.value.members) }));
    else setFailure(done.error);
  };
  return (
    <Stack gap={3}>
      <Input label={t('console.rewards.leagueCsv.reason')} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Inline>
        {/* Secondary: Points by hand's Give as earned is the screen's one gold button (ui.md). */}
        <Button variant="secondary" isDisabled={reason.trim().length < 3} isLoading={give.isPending} onClick={() => void send()}>
          {t('console.rewards.leagueCsv.give')}
        </Button>
      </Inline>
      {failure ? <ErrorMessage>{failureText(failure)}</ErrorMessage> : null}
    </Stack>
  );
}

/**
 * League points from a CSV (L-01; the owner, 2 Nov): a file of member numbers and points, read and checked line by line on
 * the screen, then given in one go with one reason, all or none, once for the file however often Give is pressed.
 */
export function LeagueCsvImport({ venueId }: { venueId: string }) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [fileProblem, setFileProblem] = useState<'unreadable' | 'tooBig' | null>(null);
  const [given, setGiven] = useState<string | null>(null);
  const choose = async (file: File) => {
    setGiven(null);
    const text = file.size > MOST_BYTES ? null : await file.text().catch(() => null);
    setFileProblem(text !== null ? null : file.size > MOST_BYTES ? 'tooBig' : 'unreadable');
    setChosen(text === null ? null : { csv: parseLeagueCsv(text), requestId: crypto.randomUUID() });
  };
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.rewards.leagueCsv.heading')}</Heading>
      <Text variant="small" tone="muted">{t('console.rewards.leagueCsv.format')}</Text>
      <Inline>
        <CameraButton variant="secondary" camera="none" accept=".csv,text/csv" onPhoto={(file) => void choose(file)}>
          {t(chosen === null ? 'console.rewards.leagueCsv.choose' : 'console.rewards.leagueCsv.chooseAnother')}
        </CameraButton>
      </Inline>
      {fileProblem ? <ErrorMessage>{t(`console.rewards.leagueCsv.${fileProblem}`)}</ErrorMessage> : null}
      {chosen ? <FileSummary chosen={chosen} /> : null}
      {chosen && chosen.csv.problems.length === 0 ? (
        <GiveFile key={chosen.requestId} venueId={venueId} chosen={chosen} onGiven={(text) => { setGiven(text); setChosen(null); }} />
      ) : null}
      <StatusMessage>{given}</StatusMessage>
    </Stack>
  );
}
