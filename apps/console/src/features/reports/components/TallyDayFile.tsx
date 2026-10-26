import { useTallyDay, type TallyFailure } from '@rivr/db/tally';
import { tallyImportXml, tallyVouchers } from '@rivr/domain/tally';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Input, Stack, Text } from '@rivr/ui';
import { useEffect, useState } from 'react';

const dayLabel = (day: string) => formatDate(new Date(`${day}T12:00:00+05:30`));

/** A file made: where it is, its name, and how many vouchers it holds. */
interface Made {
  readonly url: string;
  readonly file: string;
  readonly count: number;
  readonly day: string;
}

/** What the last try gave: a refusal, the codes still to map, or nothing posted that day. */
type Problem = { kind: 'failure'; failure: TallyFailure } | { kind: 'unmapped'; codes: readonly string[] } | { kind: 'nothing'; day: string };

function ProblemLine({ problem }: { problem: Problem }) {
  if (problem.kind === 'failure') return <ErrorMessage>{t(`console.tally.failures.${problem.failure}`)}</ErrorMessage>;
  if (problem.kind === 'unmapped') return <ErrorMessage>{t('console.tally.unmapped', { codes: problem.codes.join(', ') })}</ErrorMessage>;
  return <Text>{t('console.tally.nothing', { day: dayLabel(problem.day) })}</Text>;
}

/**
 * A club day's vouchers as a file Tally imports (#96): choose a day that has ended, make the file (the
 * postings are read under the audit log), then save it. Refused while an account posted that day has no
 * Tally ledger.
 */
export function TallyDayFile({ venueId, yesterday }: { venueId: string; yesterday: string }) {
  const tallyDay = useTallyDay(venueId);
  const [day, setDay] = useState(yesterday);
  const [made, setMade] = useState<Made | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The file lives in this page's memory until the next one replaces it, or the page closes.
  useEffect(() => (made === null ? undefined : () => URL.revokeObjectURL(made.url)), [made]);
  const make = async () => {
    setMade(null);
    const postings = await tallyDay.mutateAsync(day);
    if (!postings.ok) return setProblem({ kind: 'failure', failure: postings.error });
    const vouchers = tallyVouchers(day, postings.value);
    if (!vouchers.ok) return setProblem({ kind: 'unmapped', codes: vouchers.error.unmapped });
    if (vouchers.value.length === 0) return setProblem({ kind: 'nothing', day });
    setProblem(null);
    const url = URL.createObjectURL(new Blob([tallyImportXml(day, vouchers.value)], { type: 'application/xml;charset=utf-8' }));
    setMade({ url, file: `tally-${day}.xml`, count: vouchers.value.length, day });
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tally.dayFile')}</Heading>
      <Text variant="small" tone="muted">{t('console.tally.dayFileHint')}</Text>
      <Input type="date" label={t('console.tally.day')} value={day} onChange={(event) => setDay(event.target.value)} />
      <Button isLoading={tallyDay.isPending} isDisabled={day === ''} onClick={() => void make()}>{t('console.tally.take')}</Button>
      {problem === null ? null : <ProblemLine problem={problem} />}
      {made === null ? null : (
        <Stack gap={2} align="start">
          <Text>{t('console.tally.ready', { count: formatNumber(made.count), day: dayLabel(made.day) })}</Text>
          <Button href={made.url} download={made.file}>{t('console.tally.download', { file: made.file })}</Button>
        </Stack>
      )}
    </Stack>
  );
}
