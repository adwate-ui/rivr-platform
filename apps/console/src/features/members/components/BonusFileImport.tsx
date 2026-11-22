import { useBonusFileMembers, useSaveBonusFile, type BonusFileMember, type BonusFileRefusal } from '@rivr/db/bonusFile';
import { formatChips, formatNumber, t } from '@rivr/i18n';
import { Button, CameraButton, ConfirmButton, ErrorMessage, Inline, LoadState, readSheetFile, Sheet, Stack, StatusMessage, Text, type SheetFileProblem } from '@rivr/ui';
import { useState } from 'react';
import { keysOf, previewOf, readBonusFile, type Preview, type PreviewLine, type ReadFile } from './bonusFile.ts';
import { forgetRequestId, hasRequestId, keepRequestId, requestIdFor } from './bonusFileRequests.ts';

// A file of 500 lines is a few tens of kilobytes: a larger one is not this one, and is never read.
const MOST_BYTES = 1_048_576;
const ACCEPT = '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ToSave = NonNullable<Preview['toSave']>;
type MembersRead = { readonly data?: readonly BonusFileMember[] | undefined; readonly isError: boolean };

/** One line as the preview shows it: as it will save, or what is wrong, said with the summary above rather than alone. */
function LineView({ line }: { line: PreviewLine }) {
  const at = formatNumber(line.line);
  if (!line.ok) {
    return <ErrorMessage isAnnounced={false}>{t(`console.members.bonus.file.problems.${line.problem}`, { line: at, name: line.name ?? '' })}</ErrorMessage>;
  }
  const { member, chips, reason } = line;
  return <Text>{t(`console.members.bonus.file.${line.kind}`, { line: at, name: member.fullName, number: String(member.memberNumber), chips: formatNumber(chips), reason })}</Text>;
}

/** A refusal's words, with the line it names. */
function refusalText(refusal: BonusFileRefusal): string {
  const why = t(`console.members.bonus.file.failures.${refusal.failure}`);
  return refusal.line === null ? why : t('console.members.bonus.file.atLine', { line: formatNumber(refusal.line), why });
}

/** A file's totals, said in the sheet's one status line: `12 lines · 24,000 added · 3,500 used`. */
function totalsText(toSave: ToSave): string {
  const count = toSave.lines.length;
  return t(count === 1 ? 'console.members.bonus.file.totalsOne' : 'console.members.bonus.file.totals',
    { count: formatNumber(count), added: formatChips(toSave.added), used: formatChips(toSave.used) });
}

/** A file to save: every line, its totals said above. A file with lines to fix: how many, once, then those lines alone. */
function PreviewBody({ preview }: { preview: Preview }) {
  const wrong = preview.lines.filter((line) => !line.ok);
  const lines = preview.toSave === null ? wrong : preview.lines;
  return (
    <Stack gap={4}>
      {preview.toSave === null
        ? <ErrorMessage>{wrong.length === 1 ? t('console.members.bonus.file.toFixOne') : t('console.members.bonus.file.toFix', { count: formatNumber(wrong.length) })}</ErrorMessage>
        : null}
      <Stack gap={2} divided>{lines.map((line) => <LineView key={line.line} line={line} />)}</Stack>
    </Stack>
  );
}

/**
 * The sheet's foot, in view down a long file: what became of the last Save (a refusal, or no answer); one status line, that
 * it is saving or that this file was sent before with no answer; and Save, asked twice.
 */
function Footer({ toSave, venueId, refusal, isSaving, onSave }: { toSave: ToSave; venueId: string; refusal: BonusFileRefusal | null; isSaving: boolean; onSave: () => void }) {
  const count = toSave.lines.length;
  const isKept = refusal === null && hasRequestId(venueId, toSave.lines);
  const status = isSaving ? t('console.members.bonus.file.saving') : isKept ? t('console.members.bonus.file.resend') : null;
  return (
    <>
      {refusal === null ? null : <ErrorMessage>{refusalText(refusal)}</ErrorMessage>}
      <StatusMessage>{status}</StatusMessage>
      <ConfirmButton variant="primary" size="compact" label={t('console.members.bonus.file.save')} isBusy={isSaving} onConfirm={onSave}
        confirm={count === 1 ? t('console.members.bonus.file.confirmOne') : t('console.members.bonus.file.confirm', { count: formatNumber(count) })} />
    </>
  );
}

const savedText = (count: number) => (count === 1 ? t('console.members.bonus.file.savedOne') : t('console.members.bonus.file.saved', { count: formatNumber(count) }));

/** The file with its members as the venue reads them now; none until they are read. */
function livePreview(file: ReadFile | null, members: MembersRead, isWaiting: boolean) {
  if (file === null || isWaiting || members.isError) return null;
  return previewOf(file, members.data ?? []);
}

/**
 * A file sent before with no answer (an id is kept for it) that the venue's balances, read since, would no longer let go:
 * offered again without the balances, as the database answers a file that went as saved, and one that did not on its own.
 */
function resendPreview(venueId: string, file: ReadFile | null, members: MembersRead, live: Preview | null) {
  if (file === null || live === null || live.toSave !== null) return null;
  const unchecked = previewOf(file, members.data ?? [], false);
  return unchecked.toSave !== null && hasRequestId(venueId, unchecked.toSave.lines) ? unchecked : null;
}

/**
 * What the preview shows: the file as it was sent while its save waits for an answer, since balances read after a file
 * went would turn its lines wrong and take Save away; a file sent before with no answer, again; otherwise the file with its
 * members as the venue reads them now.
 */
function usePreview(venueId: string, read: ReadFile | null, sent: Preview | null) {
  const file = read?.fileProblem === null ? read : null;
  const keys = file === null ? [] : keysOf(file);
  const members = useBonusFileMembers(venueId, keys);
  const isWaiting = keys.length > 0 && members.data === undefined;
  const isLive = sent === null;
  const live = livePreview(file, members, isWaiting);
  return {
    preview: sent ?? resendPreview(venueId, file, members, live) ?? live, isWaiting: isLive && isWaiting, isError: isLive && members.isError,
    retry: () => void members.refetch(),
  };
}

/**
 * Sending a file under its request id (`bonusFileRequests`), kept until an answer: any answer is the last word on that id,
 * so the next try after one is a new id. With no answer the preview stays as sent, with Save, and the id stays.
 */
function useSendFile(venueId: string, onSaved: (count: number) => void) {
  const save = useSaveBonusFile(venueId);
  const [sent, setSent] = useState<Preview | null>(null);
  const [refusal, setRefusal] = useState<BonusFileRefusal | null>(null);
  const submit = async (shown: Preview, toSave: ToSave) => {
    setRefusal(null);
    setSent(shown);
    const requestId = requestIdFor(venueId, toSave.lines);
    keepRequestId(venueId, toSave.lines, requestId);
    const done = await save.mutateAsync({ lines: toSave.lines, requestId });
    if (done.ok || done.error.failure !== 'unavailable') {
      forgetRequestId(venueId, toSave.lines);
      setSent(null);
    }
    if (done.ok) return onSaved(done.value);
    setRefusal(done.error);
  };
  // Another file chosen: what was sent, and what became of it, are that file's. Its id stays kept for it.
  const reset = () => {
    setSent(null);
    setRefusal(null);
  };
  return { sent, refusal, isSaving: save.isPending, reset, submit };
}

/** The file's one hint, and the chooser, held while a file saves. */
function Chooser({ hasFile, isBusy, onChoose }: { hasFile: boolean; isBusy: boolean; onChoose: (file: File) => void }) {
  return (
    <>
      <Text variant="small" tone="muted">{t('console.members.bonus.file.format')}</Text>
      <Inline>
        <CameraButton variant="subtle" camera="none" accept={ACCEPT} isDisabled={isBusy} onPhoto={onChoose}>
          {t(hasFile ? 'console.members.bonus.file.chooseAnother' : 'console.members.bonus.file.choose')}
        </CameraButton>
      </Inline>
    </>
  );
}

/** What is below the chooser: the members loading or not read, a refusal when Save is not in the foot, and the preview. */
function Shown({ shown, refusal }: { shown: ReturnType<typeof usePreview>; refusal: BonusFileRefusal | null }) {
  if (shown.isError) return <LoadState isError onRetry={shown.retry} />;
  if (shown.isWaiting) return <LoadState />;
  return (
    <>
      {refusal === null || shown.preview?.toSave ? null : <ErrorMessage>{refusalText(refusal)}</ErrorMessage>}
      {shown.preview === null ? null : <PreviewBody preview={shown.preview} />}
    </>
  );
}

/**
 * Bonus from a file (the owner, 22 Nov; decision 0707), for super admins: a CSV or .xlsx of lines, each a member (number or
 * mobile), Add or Use, chips and a reason, read on the screen and sent nowhere until Save. Every line shows with its member;
 * a file with lines to fix shows those. Save, in the sheet's foot, sends them all in the file's order, and the database
 * takes all or none. While it saves the sheet stays open and no other file is chosen, so its answer is always seen.
 */
export function BonusFileSheet({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const [read, setRead] = useState<ReadFile | null>(null);
  const [problem, setProblem] = useState<SheetFileProblem | ReadFile['fileProblem']>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const send = useSendFile(venueId, (count) => { setRead(null); setSaved(savedText(count)); });
  const shown = usePreview(venueId, read, send.sent);
  const choose = async (file: File) => {
    send.reset();
    setSaved(null);
    setRead(null);
    setProblem(null);
    const sheet = await readSheetFile(file, MOST_BYTES);
    const next = sheet.ok ? readBonusFile(sheet.rows) : null;
    setProblem(sheet.ok ? next?.fileProblem ?? null : sheet.problem);
    setRead(next);
  };
  const { preview } = shown;
  const toSave = preview?.toSave ?? null;
  const footer = preview === null || toSave === null ? undefined
    : <Footer toSave={toSave} venueId={venueId} refusal={send.refusal} isSaving={send.isSaving} onSave={() => void send.submit(preview, toSave)} />;
  return (
    <Sheet place="console" isOpen onClose={() => { if (!send.isSaving) onClose(); }} title={t('console.members.bonus.file.open')} footer={footer}>
      <Stack gap={4}>
        <Chooser hasFile={read !== null} isBusy={send.isSaving} onChoose={(file) => void choose(file)} />
        {problem === null ? null : <ErrorMessage>{t(`console.members.bonus.file.${problem}`)}</ErrorMessage>}
        {/* The one status line, always in place: the file's totals, or that it was saved. */}
        <StatusMessage>{saved ?? (toSave === null ? null : totalsText(toSave))}</StatusMessage>
        <Shown shown={shown} refusal={send.refusal} />
      </Stack>
    </Sheet>
  );
}

/** Bonus from a file, beside Export on Members for super admins: it opens the file's sheet at the side, a fresh one each time. */
export function BonusFilePanel({ venueId }: { venueId: string }) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="subtle" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{t('console.members.bonus.file.open')}</Button>
      {isOpen ? <BonusFileSheet key={opened} venueId={venueId} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
