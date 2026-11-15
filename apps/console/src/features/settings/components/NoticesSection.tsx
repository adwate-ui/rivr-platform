import { zodResolver } from '@hookform/resolvers/zod';
import { noticeFormSchema, type NoticeFormValues } from '@rivr/contracts/notices';
import { useNoticeActions, useVenueNotices, type NoticeFailure, type VenueNotice } from '@rivr/db/notices';
import { formatDateTime, formatIsoDay, formatTime, t } from '@rivr/i18n';
import { Button, ConfirmButton, ErrorMessage, Heading, Inline, Input, LoadState, NoticeCard, NoticeText, Sheet, Stack, StatusMessage, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type FieldError, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type Outcome = { ok: boolean; text: string } | null;
type NoticeForm = UseFormReturn<NoticeFormValues, unknown, z.output<typeof noticeFormSchema>>;
/** The notice the form edits, and whether it already shows (its start then stays); null while putting one up. */
type Editing = { noticeId: string; isLive: boolean } | null;
const EMPTY: NoticeFormValues = { body: '', startDay: '', startTime: '', endDay: '', endTime: '' };

/** A notice in the form: its words, and its start and end as IST days (`2026-11-15`) and 24-hour times (`19:00`). */
function valuesOf(notice: VenueNotice): NoticeFormValues {
  const at = (moment: string | null) => (moment === null ? ['', ''] : [formatIsoDay(new Date(moment)), formatTime(new Date(moment))]);
  const [[startDay = '', startTime = ''], [endDay = '', endTime = '']] = [at(notice.startsAt), at(notice.endsAt)];
  return { body: notice.body, startDay, startTime, endDay, endTime };
}

/** What a day's or time's error says (noticeFormSchema's codes). */
function whenError(error: FieldError | undefined): string | undefined {
  if (error === undefined) return undefined;
  if (error.message === 'before_start') return t('console.settings.notices.endBeforeStart');
  return error.message === 'needs_day' ? t('console.settings.notices.invalidDay') : t('console.settings.notices.invalidTime');
}

/**
 * The form in the panel at the side (redesign RD-38) and what its buttons do: open it for a new notice or to edit one,
 * put up or save, leave it, and end a notice from its row.
 */
function useNoticeEditor(venueId: string) {
  const { post, update, end } = useNoticeActions(venueId);
  const [resolver] = useState(() => zodResolver(noticeFormSchema));
  const form: NoticeForm = useForm<NoticeFormValues, unknown, z.output<typeof noticeFormSchema>>({ resolver, defaultValues: EMPTY });
  const [editing, setEditing] = useState<Editing>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isOpen, setIsOpen] = useState(false);
  const failed = (error: NoticeFailure) => ({ ok: false, text: t(`console.settings.notices.failures.${error}`) });
  const leave = () => { form.reset(EMPTY); setEditing(null); setIsOpen(false); };
  const open = () => { form.reset(EMPTY); setEditing(null); setOutcome(null); setIsOpen(true); };
  const edit = (notice: VenueNotice) => {
    form.reset(valuesOf(notice));
    setEditing({ noticeId: notice.noticeId, isLive: Date.parse(notice.startsAt) <= new Date().getTime() });
    setOutcome(null);
    setIsOpen(true);
  };
  const save = form.handleSubmit(async ({ body, startsAt, endsAt }) => {
    // A live notice keeps its start; one still to come left blank starts now, as a new one does.
    const start = editing === null ? startsAt : editing.isLive ? null : (startsAt ?? new Date().toISOString());
    const done = editing === null ? await post.mutateAsync({ body, startsAt: start, endsAt }) : await update.mutateAsync({ noticeId: editing.noticeId, body, startsAt: start, endsAt });
    setOutcome(done.ok ? { ok: true, text: t(editing === null ? 'console.settings.notices.posted' : 'console.settings.notices.saved') } : failed(done.error));
    if (done.ok) leave();
    // Ended meanwhile: the words stay in the form, to put up as a new notice.
    else if (done.error === 'ended') setEditing(null);
  });
  const endOne = async (noticeId: string) => {
    const done = await end.mutateAsync(noticeId);
    setOutcome(done.ok ? { ok: true, text: t('console.settings.notices.ended') } : failed(done.error));
  };
  const cancel = () => { leave(); setOutcome(null); };
  const clearOutcome = () => setOutcome(null);
  const bodyField = form.register('body', { onChange: clearOutcome });
  return { form, bodyField, editing, outcome, isOpen, open, edit, save, cancel, endOne, clearOutcome, isSaving: post.isPending || update.isPending, isEnding: end.isPending };
}
type NoticeEditor = ReturnType<typeof useNoticeEditor>;

/** One notice in force or to come: its words as members see them, when, and Edit and End, small as a row's actions are. */
function NoticeRow({ notice, now, onEdit, onEnd, isBusy }: { notice: VenueNotice; now: Date; onEdit: () => void; onEnd: () => void; isBusy: boolean }) {
  const until = notice.endsAt === null ? t('console.settings.notices.untilEnded') : t('console.settings.notices.until', { date: formatDateTime(new Date(notice.endsAt)) });
  const isComing = Date.parse(notice.startsAt) > now.getTime();
  return (
    <Inline gap={4} justify="between" align="center">
      <Stack gap={1}>
        <NoticeText text={notice.body} />
        <Text tone="muted" variant="small">
          {isComing ? t('console.settings.notices.startsUntil', { start: formatDateTime(new Date(notice.startsAt)), until }) : until}
        </Text>
      </Stack>
      <Inline gap={2}>
        <Button variant="subtle" size="small" aria-label={t('console.settings.notices.editName', { body: notice.body })} onClick={onEdit}>
          {t('console.settings.notices.edit')}
        </Button>
        <ConfirmButton variant="subtle" size="small" label={t('console.settings.notices.end')} name={t('console.settings.notices.endName', { body: notice.body })}
          confirm={t('console.settings.notices.endConfirm')} isBusy={isBusy} onConfirm={onEnd} />
      </Inline>
    </Inline>
  );
}

/** The notice as members' Tonight shows it (decision 0424), as it is typed: its card, line breaks and links. */
function NoticePreview({ body }: { body: string }) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">{t('console.settings.notices.preview')}</Text>
      <NoticeCard label={t('console.settings.notices.previewLabel')} text={body.trim() === '' ? t('console.settings.notices.previewEmpty') : body} />
    </Stack>
  );
}

/** When it shows: a start (read only once live) and an end, each an IST day and time, each field with its own error. */
function WhenFields({ editor }: { editor: NoticeEditor }) {
  const { form, editing } = editor;
  const edited = { onChange: editor.clearOutcome };
  const fields = {
    startDay: form.register('startDay', edited), startTime: form.register('startTime', edited),
    endDay: form.register('endDay', edited), endTime: form.register('endTime', edited),
  };
  const errors = form.formState.errors;
  const isLive = editing?.isLive === true;
  return (
    <>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.startDay} type="date" label={t('console.settings.notices.startDay')} readOnly={isLive} error={whenError(errors.startDay)} />
        <Input {...fields.startTime} label={t('console.settings.notices.startTime')} inputMode="numeric" autoComplete="off" readOnly={isLive}
          hint={isLive ? t('console.settings.notices.startLive') : t('console.settings.notices.startHint')} error={whenError(errors.startTime)} />
      </Inline>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.endDay} type="date" label={t('console.settings.notices.endDay')} error={whenError(errors.endDay)} />
        <Input {...fields.endTime} label={t('console.settings.notices.endTime')} hint={t('console.settings.notices.endHint')} inputMode="numeric"
          autoComplete="off" error={whenError(errors.endTime)} />
      </Inline>
    </>
  );
}

/**
 * The form in the panel, over its preview: the words, when it shows, and at its foot Cancel and Put up, or Save changes
 * while editing. What went wrong is said in the panel; what went through is said on the screen, once it has closed.
 */
function NoticeSheet({ editor }: { editor: NoticeEditor }) {
  const { form, editing, outcome } = editor;
  const body = form.watch('body');
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={editor.cancel}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={editor.isSaving} onClick={() => void editor.save()}>
        {editing === null ? t('console.settings.notices.post') : t('console.settings.notices.save')}
      </Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={editor.cancel} footer={footer}
      title={editing === null ? t('console.settings.notices.newTitle') : t('console.settings.notices.editTitle')}>
      <Stack gap={4}>
        {/* Counted as the database counts: an emoji is one character. */}
        <TextArea {...editor.bodyField} label={t('console.settings.notices.body')} hint={t('console.settings.notices.bodyHint', { count: [...body].length })} rows={5} />
        <WhenFields editor={editor} />
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
        <NoticePreview body={body} />
      </Stack>
    </Sheet>
  );
}

/** What the last step did, said on the screen: what went through, and what went wrong ending a notice on its row (the form's own is said in the panel). */
function SectionOutcome({ editor }: { editor: NoticeEditor }) {
  const { outcome, isOpen } = editor;
  return (
    <>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false && !isOpen ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </>
  );
}

/**
 * Notices on members' Tonight (decisions 0298 and 0424): put one up, now or from a start to an end, seen as members will
 * see it while it is typed; edit one up or to come; end one. Putting one up and editing one open the panel at the side
 * (redesign RD-38). For staff with settings.manage; the database refuses anyone else.
 */
export function NoticesSection({ venueId }: { venueId: string }) {
  const notices = useVenueNotices(venueId);
  const editor = useNoticeEditor(venueId);
  // When the list last came, which moves on with every reload after a change: whether a notice is still to come.
  const now = new Date(notices.dataUpdatedAt);
  return (
    <Stack gap={6}>
      <Heading level={2} variant="section">{t('console.settings.notices.title')}</Heading>
      {notices.data === undefined ? <LoadState isError={notices.isError} onRetry={() => void notices.refetch()} /> : null}
      {notices.data?.length === 0 ? <Text>{t('console.settings.notices.none')}</Text> : null}
      {notices.data?.map((notice) => (
        <NoticeRow key={notice.noticeId} notice={notice} now={now} isBusy={editor.isEnding} onEdit={() => editor.edit(notice)}
          onEnd={() => void editor.endOne(notice.noticeId)} />
      ))}
      <Inline><Button variant="primary" onClick={editor.open}>{t('console.settings.notices.newTitle')}</Button></Inline>
      <SectionOutcome editor={editor} />
      {editor.isOpen ? <NoticeSheet editor={editor} /> : null}
    </Stack>
  );
}
