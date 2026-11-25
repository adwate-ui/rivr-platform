import { useFloorTables, useSaveVisitFile, type VisitFileLine, type VisitFileRefusal } from '@rivr/db';
import { useBonusFileMembers, type BonusFileMember } from '@rivr/db/bonusFile';
import { formatDate, formatNumber, formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, CameraButton, ConfirmButton, ErrorMessage, Inline, LoadState, readSheetFile, Sheet, Stack, StatusMessage, Text, type SheetFileProblem } from '@rivr/ui';
import { useState } from 'react';
import { readVisitFile, visitKeysOf, visitPreviewOf, type NamedTable, type VisitPreview, type VisitPreviewLine, type VisitReadFile } from './visitFile.ts';

// A file of 500 lines is a few tens of kilobytes: a larger one is not this one, and is never read.
const MOST_BYTES = 1_048_576;
const ACCEPT = '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One line as the preview shows it: the visit as it will save, or what is wrong, said with the summary above rather than alone. */
function LineView({ line }: { line: VisitPreviewLine }) {
  const at = formatNumber(line.line);
  if (!line.ok) return <ErrorMessage isAnnounced={false}>{t(`console.members.visitsAdded.file.problems.${line.problem}`, { line: at })}</ErrorMessage>;
  return (
    <Text>
      {t('console.members.visitsAdded.file.line', {
        line: at, name: line.member.fullName, number: String(line.member.memberNumber), date: formatDate(line.openedAt),
        from: formatTime(line.openedAt), to: formatTime(line.closedAt), table: line.tableName, reason: line.reason,
      })}
    </Text>
  );
}

/** A refusal's words, with the line it names. */
function refusalText(refusal: VisitFileRefusal): string {
  const why = t(`console.members.visitsAdded.failures.${refusal.failure}`);
  return refusal.line === null ? why : t('console.members.visitsAdded.file.atLine', { line: formatNumber(refusal.line), why });
}

/** A file to save: every line. A file with lines to fix: how many, once, then those lines alone. */
function PreviewBody({ preview }: { preview: VisitPreview }) {
  const wrong = preview.lines.filter((line) => !line.ok);
  const lines = preview.toSave === null ? wrong : preview.lines;
  return (
    <Stack gap={4}>
      {preview.toSave === null
        ? <ErrorMessage>{wrong.length === 1 ? t('console.members.visitsAdded.file.toFixOne') : t('console.members.visitsAdded.file.toFix', { count: formatNumber(wrong.length) })}</ErrorMessage>
        : null}
      <Stack gap={2} divided>{lines.map((line) => <LineView key={line.line} line={line} />)}</Stack>
    </Stack>
  );
}

const countText = (count: number, one: MessageKey, many: MessageKey) => (count === 1 ? t(one) : t(many, { count: formatNumber(count) }));
const totalsText = (count: number) => countText(count, 'console.members.visitsAdded.file.totalsOne', 'console.members.visitsAdded.file.totals');
const savedText = (count: number) => countText(count, 'console.members.visitsAdded.file.savedOne', 'console.members.visitsAdded.file.saved');
const confirmText = (count: number) => countText(count, 'console.members.visitsAdded.file.confirmOne', 'console.members.visitsAdded.file.confirm');

/** The venue's tables, by which a file's lines name them; none until they are read. */
function useVenueTables(venueId: string) {
  const tables = useFloorTables();
  return { tables: tables.data?.filter((table) => table.venueId === venueId), isError: tables.isError, retry: () => void tables.refetch() };
}

/** The preview once the file, its members and the tables are all read; none before. */
function previewOf(file: VisitReadFile | null, members: readonly BonusFileMember[] | undefined, tables: readonly NamedTable[] | undefined): VisitPreview | null {
  return file === null || members === undefined || tables === undefined ? null : visitPreviewOf(file, members, tables);
}

/** The file with its members and the venue's tables, once both are read. */
function usePreview(venueId: string, read: VisitReadFile | null) {
  const file = read?.fileProblem === null ? read : null;
  const keys = file === null ? [] : visitKeysOf(file);
  const members = useBonusFileMembers(venueId, keys);
  const venue = useVenueTables(venueId);
  const isError = members.isError || venue.isError;
  const preview = previewOf(file, members.data, venue.tables);
  return {
    preview, isWaiting: keys.length > 0 && preview === null && !isError, isError, retry: () => { void members.refetch(); venue.retry(); },
  };
}

/** Saving the file under one request id, kept until it is answered, so Save again after no answer adds nothing twice. */
function useSendFile(venueId: string, onSaved: (count: number) => void) {
  const save = useSaveVisitFile(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [refusal, setRefusal] = useState<VisitFileRefusal | null>(null);
  const submit = async (lines: readonly VisitFileLine[]) => {
    setRefusal(null);
    const done = await save.mutateAsync({ lines, requestId });
    if (done.ok || done.error.failure !== 'unavailable') setRequestId(crypto.randomUUID());
    if (done.ok) return onSaved(done.value);
    return setRefusal(done.error);
  };
  return { refusal, isSaving: save.isPending, submit, reset: () => { setRefusal(null); setRequestId(crypto.randomUUID()); } };
}

/** What is below the chooser: the members loading or not read, then the preview. */
function Shown({ shown }: { shown: ReturnType<typeof usePreview> }) {
  if (shown.isError) return <LoadState isError onRetry={shown.retry} />;
  if (shown.isWaiting) return <LoadState />;
  return shown.preview === null ? null : <PreviewBody preview={shown.preview} />;
}

/** The sheet's foot once every line is right: a refusal, that it is saving, and Save, asked twice. */
function Footer({ toSave, send }: { toSave: readonly VisitFileLine[]; send: ReturnType<typeof useSendFile> }) {
  return (
    <>
      {send.refusal === null ? null : <ErrorMessage>{refusalText(send.refusal)}</ErrorMessage>}
      <StatusMessage>{send.isSaving ? t('console.members.visitsAdded.file.saving') : null}</StatusMessage>
      <ConfirmButton variant="primary" size="compact" label={t('console.members.visitsAdded.file.save')} isBusy={send.isSaving} onConfirm={() => void send.submit(toSave)}
        confirm={confirmText(toSave.length)} />
    </>
  );
}

/**
 * Visits from a file (the owner, 25 Nov; #1134), for super admins: a CSV or .xlsx of lines, each a member (number or
 * mobile), the club night, check-in, check-out, table and a reason, read on the screen and sent nowhere until Save. Every
 * line shows with its member and table; a file with lines to fix shows those. Save adds them all, or none.
 */
export function VisitFileSheet({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const [read, setRead] = useState<VisitReadFile | null>(null);
  const [problem, setProblem] = useState<SheetFileProblem | VisitReadFile['fileProblem']>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const send = useSendFile(venueId, (count) => { setRead(null); setSaved(savedText(count)); });
  const shown = usePreview(venueId, read);
  const choose = async (file: File) => {
    send.reset();
    setSaved(null);
    setRead(null);
    const sheet = await readSheetFile(file, MOST_BYTES);
    const next = sheet.ok ? readVisitFile(sheet.rows) : null;
    setProblem(sheet.ok ? next?.fileProblem ?? null : sheet.problem);
    setRead(next);
  };
  const toSave = shown.preview?.toSave ?? null;
  return (
    <Sheet place="console" isOpen onClose={() => { if (!send.isSaving) onClose(); }} title={t('console.members.visitsAdded.file.open')}
      footer={toSave === null ? undefined : <Footer toSave={toSave} send={send} />}>
      <Stack gap={4}>
        <Text variant="small" tone="muted">{t('console.members.visitsAdded.file.format')}</Text>
        <Inline>
          <CameraButton variant="subtle" camera="none" accept={ACCEPT} isDisabled={send.isSaving} onPhoto={(file) => void choose(file)}>
            {t(read === null ? 'console.members.visitsAdded.file.choose' : 'console.members.visitsAdded.file.chooseAnother')}
          </CameraButton>
        </Inline>
        {problem === null ? null : <ErrorMessage>{t(`console.members.visitsAdded.file.${problem}`)}</ErrorMessage>}
        <StatusMessage>{saved ?? (toSave === null ? null : totalsText(toSave.length))}</StatusMessage>
        <Shown shown={shown} />
      </Stack>
    </Sheet>
  );
}

/** Visits from a file, beside Bonus from a file on Members for super admins: a fresh sheet each time. */
export function VisitFilePanel({ venueId }: { venueId: string }) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="subtle" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{t('console.members.visitsAdded.file.open')}</Button>
      {isOpen ? <VisitFileSheet key={opened} venueId={venueId} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
