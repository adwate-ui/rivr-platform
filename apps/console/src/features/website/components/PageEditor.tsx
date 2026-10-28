import { siteBlockSchema } from '@rivr/contracts';
import { istMoment } from '@rivr/contracts/tournaments';
import { useEditorPage, useSiteEditor, type EditorBlock, type EditorPage, type SiteEditFailure, type SiteRevision } from '@rivr/db/siteEditor';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, LoadState, Stack, StatusMessage, WebPreview } from '@rivr/ui';
import { useState } from 'react';
import { BlockEditor } from './BlockEditor.tsx';
import { RevisionHistory } from './RevisionHistory.tsx';

type Outcome = { ok: boolean; text: string } | null;
const WEB_URL = import.meta.env.VITE_WEB_URL;

/** The draft to edit: the page's draft or scheduled version if it has one, else what it shows now. */
function startingBlocks(blocks: readonly EditorBlock[], revisions: readonly SiteRevision[]): readonly EditorBlock[] {
  return revisions.find((revision) => revision.status === 'draft' || revision.status === 'scheduled')?.blocks ?? blocks;
}

/** The preview's address for a draft's token, a new one each save so the frame reads it again. */
function previewSrc(token: string | null, saves: number): string | null {
  return WEB_URL === undefined || token === null ? null : `${WEB_URL}/preview/${token}?v=${String(saves)}`;
}

interface ActionsProps {
  readonly canPublish: boolean;
  readonly isSaving: boolean;
  readonly isPublishing: boolean;
  readonly onSave: () => void;
  readonly onPublish: (when: Date | null) => void;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Saving the draft, and publishing it now or on an IST day and 24-hour time; publishing waits until the edits are saved. */
function Actions({ canPublish, isSaving, isPublishing, onSave, onPublish }: ActionsProps) {
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const isWhen = DAY.test(day) && TIME.test(time);
  return (
    <>
      <Inline gap={2}>
        <Button variant="secondary" isLoading={isSaving} onClick={onSave}>{t('console.website.save')}</Button>
        <Button variant="primary" isDisabled={!canPublish} isLoading={isPublishing} onClick={() => onPublish(null)}>{t('console.website.publish')}</Button>
      </Inline>
      <Inline gap={2}>
        <Input type="date" label={t('console.website.publishOn')} value={day} onChange={(event) => setDay(event.target.value)} />
        <Input label={t('console.website.publishAt')} hint={t('console.website.timeHint')} value={time} inputMode="numeric" autoComplete="off"
          onChange={(event) => setTime(event.target.value.trim())} />
        <Button variant="secondary" isDisabled={!canPublish || !isWhen} isLoading={isPublishing} onClick={() => onPublish(istMoment(day, time))}>
          {t('console.website.schedule')}
        </Button>
      </Inline>
    </>
  );
}

interface EditorProps {
  readonly venueId: string;
  readonly page: EditorPage;
  readonly start: readonly EditorBlock[];
  readonly revisions: readonly SiteRevision[];
  /** What last happened, kept by the page, so a publish or rollback's word outlasts the editor starting again. */
  readonly outcome: Outcome;
  readonly setOutcome: (outcome: Outcome) => void;
}

/** A time to publish at, or null to publish now: a time already past publishes now. */
const laterOrNow = (at: Date | null): Date | null => (at !== null && at.getTime() > Date.now() ? at : null);

/** A page's draft in the editor: its blocks, its preview token and saves, what last happened, and saving, publishing and restoring. */
function useDraft({ venueId, page, start, revisions, setOutcome }: EditorProps) {
  const editor = useSiteEditor(venueId, page.pageId);
  const [blocks, setBlocks] = useState(start);
  // The draft's preview token, and how many saves the preview has shown, so the frame reads it again after each.
  const [preview, setPreview] = useState({ token: revisions.find((revision) => revision.status === 'draft' || revision.status === 'scheduled')?.previewToken ?? null, saves: 0 });
  const [isEdited, setEdited] = useState(false);
  const done = (text: string) => setOutcome({ ok: true, text });
  const fail = (error: SiteEditFailure) => setOutcome({ ok: false, text: t(`console.website.failures.${error}`) });
  const save = () => {
    if (blocks.some((block) => !siteBlockSchema.safeParse(block).success)) {
      fail('invalid');
      return;
    }
    void editor.save.mutateAsync(blocks).then((saved) => {
      if (!saved.ok) {
        fail(saved.error);
        return;
      }
      setPreview((last) => ({ token: saved.value, saves: last.saves + 1 }));
      setEdited(false);
      done(t('console.website.saved'));
    }, () => fail('unavailable'));
  };
  const publish = (at: Date | null) => {
    const when = laterOrNow(at);
    void editor.publish.mutateAsync(when).then((result) => {
      if (result.ok) done(when === null ? t('console.website.published') : t('console.website.scheduled', { when: formatDayTime(when) }));
      else fail(result.error);
    }, () => fail('unavailable'));
  };
  const edit = (index: number, next: EditorBlock) => {
    setBlocks((current) => current.map((each, place) => (place === index ? next : each)));
    setEdited(true);
  };
  const restore = (revision: SiteRevision) => void editor.rollback.mutateAsync(revision.revisionId).then((result) => {
    if (result.ok) done(t('console.website.restored'));
    else fail(result.error);
  }, () => fail('unavailable'));
  return { editor, blocks, edit, canPublish: preview.token !== null && !isEdited, token: preview.token, saves: preview.saves, save, publish, restore };
}

/** The page's blocks in place, the draft saved and previewed, then published now or at a time; and its history. */

function Editor(props: EditorProps) {
  const { page, revisions, outcome } = props;
  const draft = useDraft(props);
  return (
    <Stack gap={6}>
      {draft.blocks.map((block, index) => (
        <BlockEditor key={`${String(index)}-${block.kind}`} block={block} position={index + 1}
          onChange={(next) => draft.edit(index, next)} />
      ))}
      <Actions canPublish={draft.canPublish} isSaving={draft.editor.save.isPending} isPublishing={draft.editor.publish.isPending}
        onSave={draft.save} onPublish={draft.publish} />
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      <WebPreview label={t('console.website.preview', { page: page.title })} src={previewSrc(draft.token, draft.saves)}
        emptyText={WEB_URL === undefined ? t('console.website.noPreview') : t('console.website.saveToPreview')} />
      <RevisionHistory revisions={revisions} onRestore={draft.restore} />
    </Stack>
  );
}

/** A page in the website editor (#129): its draft, preview and history, once its blocks are read. */
export function PageEditor({ venueId, page }: { venueId: string; page: EditorPage }) {
  const state = useEditorPage(page.pageId);
  const [outcome, setOutcome] = useState<Outcome>(null);
  if (state.data === undefined) return <LoadState isError={state.isError} onRetry={() => void state.refetch()} />;
  // A publish or a rollback makes a new newest version: the editor starts again from what the page then holds.
  const latest = state.data.revisions[0];
  return (
    <Editor key={latest === undefined ? 'none' : `${latest.revisionId}-${latest.status}`} venueId={venueId} page={page}
      start={startingBlocks(state.data.blocks, state.data.revisions)} revisions={state.data.revisions} outcome={outcome} setOutcome={setOutcome} />
  );
}
