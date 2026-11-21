import { useBonusFileMembers, useSaveBonusFile, type BonusFileRefusal } from '@rivr/db/bonusFile';
import { formatChips, formatNumber, t } from '@rivr/i18n';
import { Button, CameraButton, ConfirmButton, ErrorMessage, Inline, LoadState, readSheetFile, Sheet, Stack, StatusMessage, Text, type SheetFileProblem } from '@rivr/ui';
import { useState } from 'react';
import { keysOf, previewOf, readBonusFile, type Preview, type PreviewLine, type ReadFile } from './bonusFile.ts';

// A file of 500 lines is a few tens of kilobytes: a larger one is not this one, and is never read.
const MOST_BYTES = 1_048_576;
const ACCEPT = '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The request id of each file sent with no answer, by what it holds. The same file again, whether Save is pressed again, the
 * file chosen again or the panel opened again, goes under that id, so a file that went through unseen is never saved twice.
 */
type Unanswered = Map<string, string>;

/** One line as the preview shows it: as it will save, or what is wrong, said with the summary above rather than alone. */
function LineView({ line }: { line: PreviewLine }) {
  const at = formatNumber(line.line);
  if (!line.ok) return <ErrorMessage isAnnounced={false}>{t(`console.members.bonus.file.problems.${line.problem}`, { line: at })}</ErrorMessage>;
  const { member, chips, reason } = line;
  return <Text>{t(`console.members.bonus.file.${line.kind}`, { line: at, name: member.fullName, number: String(member.memberNumber), chips: formatNumber(chips), reason })}</Text>;
}

/** A refusal's words, with the line it names. */
function refusalText(refusal: BonusFileRefusal): string {
  const why = t(`console.members.bonus.file.failures.${refusal.failure}`);
  return refusal.line === null ? why : t('console.members.bonus.file.atLine', { line: formatNumber(refusal.line), why });
}

/** The totals and Save, asked twice, for a file whose every line is right. Its request id is the file's until an answer comes. */
function SaveFile({ venueId, toSave, unanswered, onSaved }: { venueId: string; toSave: NonNullable<Preview['toSave']>; unanswered: Unanswered; onSaved: (count: number) => void }) {
  const save = useSaveBonusFile(venueId);
  const file = JSON.stringify(toSave.lines);
  const [requestId, setRequestId] = useState(() => unanswered.get(file) ?? crypto.randomUUID());
  const [refusal, setRefusal] = useState<BonusFileRefusal | null>(null);
  const count = toSave.lines.length;
  const submit = async () => {
    setRefusal(null);
    const done = await save.mutateAsync({ lines: toSave.lines, requestId });
    if (!done.ok && done.error.failure === 'unavailable') {
      unanswered.set(file, requestId);
      return setRefusal(done.error);
    }
    // An answer: the next try of this file, refused or not, is a new one.
    unanswered.delete(file);
    if (done.ok) return onSaved(done.value);
    setRefusal(done.error);
    setRequestId(crypto.randomUUID());
  };
  const totals = { count: formatNumber(count), added: formatChips(toSave.added), used: formatChips(toSave.used) };
  return (
    <Stack gap={2}>
      <Text>{t(count === 1 ? 'console.members.bonus.file.totalsOne' : 'console.members.bonus.file.totals', totals)}</Text>
      <Inline>
        <ConfirmButton variant="subtle" size="compact" label={t('console.members.bonus.file.save')} isBusy={save.isPending} onConfirm={() => void submit()}
          confirm={count === 1 ? t('console.members.bonus.file.confirmOne') : t('console.members.bonus.file.confirm', { count: formatNumber(count) })} />
      </Inline>
      {refusal === null ? null : <ErrorMessage>{refusalText(refusal)}</ErrorMessage>}
    </Stack>
  );
}

/** What is wrong, as one message, for a file with lines to fix. */
function ToFix({ count }: { count: number }) {
  return <ErrorMessage>{count === 1 ? t('console.members.bonus.file.toFixOne') : t('console.members.bonus.file.toFix', { count: formatNumber(count) })}</ErrorMessage>;
}

/** Every line with its member, read from the venue; above them the totals and Save once every line is right, or how many to fix. */
function FilePreview({ venueId, read, unanswered, onSaved }: { venueId: string; read: ReadFile; unanswered: Unanswered; onSaved: (count: number) => void }) {
  const keys = keysOf(read);
  const members = useBonusFileMembers(venueId, keys);
  if (members.isError) return <LoadState isError onRetry={() => void members.refetch()} />;
  if (keys.length > 0 && members.data === undefined) return <LoadState />;
  const preview = previewOf(read, members.data ?? []);
  return (
    <Stack gap={4}>
      {preview.toSave === null
        ? <ToFix count={preview.lines.filter((line) => !line.ok).length} />
        : <SaveFile venueId={venueId} toSave={preview.toSave} unanswered={unanswered} onSaved={onSaved} />}
      <Stack gap={2} divided>{preview.lines.map((line) => <LineView key={line.line} line={line} />)}</Stack>
    </Stack>
  );
}

const savedText = (count: number) => (count === 1 ? t('console.members.bonus.file.savedOne') : t('console.members.bonus.file.saved', { count: formatNumber(count) }));

/**
 * Bonus from a file (the owner, 22 Nov; decision 0707), for super admins: a CSV or .xlsx of lines, each a member (number or
 * mobile), Add or Use, chips and a reason, read on the screen and sent nowhere until Save. Every line shows with its member or
 * what is wrong; Save sends them all, in the file's order, and the database takes all or none. The body of `BonusFilePanel`,
 * which keeps `unanswered` while Members is open.
 */
export function BonusFileImport({ venueId, unanswered }: { venueId: string; unanswered: Unanswered }) {
  const [read, setRead] = useState<ReadFile | null>(null);
  const [fileProblem, setFileProblem] = useState<SheetFileProblem | null>(null);
  // Each file chosen starts afresh, without the last one's refusal.
  const [chosen, setChosen] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const choose = async (file: File) => {
    setSaved(null);
    const sheet = await readSheetFile(file, MOST_BYTES);
    setFileProblem(sheet.ok ? null : sheet.problem);
    setRead(sheet.ok ? readBonusFile(sheet.rows) : null);
    setChosen((count) => count + 1);
  };
  const isRead = read !== null && read.fileProblem === null;
  return (
    <Stack gap={4}>
      <Text variant="small" tone="muted">{t('console.members.bonus.file.format')}</Text>
      <Inline>
        <CameraButton variant="subtle" camera="none" accept={ACCEPT} onPhoto={(file) => void choose(file)}>
          {t(read === null ? 'console.members.bonus.file.choose' : 'console.members.bonus.file.chooseAnother')}
        </CameraButton>
      </Inline>
      {fileProblem === null ? null : <ErrorMessage>{t(`console.members.bonus.file.${fileProblem}`)}</ErrorMessage>}
      {read?.fileProblem ? <ErrorMessage>{t(`console.members.bonus.file.${read.fileProblem}`)}</ErrorMessage> : null}
      {isRead ? (
        <FilePreview key={chosen} venueId={venueId} read={read} unanswered={unanswered} onSaved={(count) => { setSaved(savedText(count)); setRead(null); }} />
      ) : null}
      <StatusMessage>{saved}</StatusMessage>
    </Stack>
  );
}

/** Bonus from a file, beside Export on Members for super admins: it opens the file's form in the panel at the side, a fresh one each time. */
export function BonusFilePanel({ venueId }: { venueId: string }) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  // One map while Members is open, changed in place: never set again, so it never renders anything again.
  const [unanswered] = useState<Unanswered>(() => new Map());
  const title = t('console.members.bonus.file.open');
  return (
    <>
      <Button variant="subtle" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{title}</Button>
      {isOpen ? (
        <Sheet place="console" isOpen onClose={() => setIsOpen(false)} title={title}>
          <BonusFileImport key={opened} venueId={venueId} unanswered={unanswered} />
        </Sheet>
      ) : null}
    </>
  );
}
