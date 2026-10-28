import { siteBlockSchema } from '@rivr/contracts';
import { useEditorPage, useSiteEditor, type EditorBlock, type EditorPage, type SiteEditFailure, type SiteRevision } from '@rivr/db/siteEditor';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, StatusMessage, Text, WebPreview } from '@rivr/ui';
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
  readonly hasDraft: boolean;
  readonly isSaving: boolean;
  readonly isPublishing: boolean;
  readonly onSave: () => void;
  readonly onPublish: (when: Date | null) => void;
}

/** Saving the draft, and publishing it now or at a time. */
function Actions({ hasDraft, isSaving, isPublishing, onSave, onPublish }: ActionsProps) {
  const [at, setAt] = useState('');
  return (
    <>
      <Inline gap={2}>
        <Button variant="secondary" isLoading={isSaving} onClick={onSave}>{t('console.website.save')}</Button>
        <Button variant="primary" isDisabled={!hasDraft} isLoading={isPublishing} onClick={() => onPublish(null)}>{t('console.website.publish')}</Button>
      </Inline>
      <Inline gap={2}>
        <Input type="datetime-local" label={t('console.website.publishAt')} value={at} onChange={(event) => setAt(event.target.value)} />
        <Button variant="secondary" isDisabled={!hasDraft || at === ''} onClick={() => onPublish(new Date(at))}>{t('console.website.schedule')}</Button>
      </Inline>
    </>
  );
}

/** A page's draft in the editor: its blocks, its preview token and saves, what last happened, and saving, publishing and restoring. */
function useDraft(venueId: string, pageId: string, start: readonly EditorBlock[], revisions: readonly SiteRevision[]) {
  const editor = useSiteEditor(venueId, pageId);
  const [blocks, setBlocks] = useState(start);
  const [token, setToken] = useState(revisions.find((revision) => revision.status === 'draft' || revision.status === 'scheduled')?.previewToken ?? null);
  const [saves, setSaves] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
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
      setToken(saved.value);
      setSaves((count) => count + 1);
      done(t('console.website.saved'));
    });
  };
  const publish = (when: Date | null) => void editor.publish.mutateAsync(when).then((result) => {
    if (result.ok) done(when === null ? t('console.website.published') : t('console.website.scheduled', { when: formatDayTime(when) }));
    else fail(result.error);
  });
  const restore = (revision: SiteRevision) => void editor.rollback.mutateAsync(revision.revisionId).then((result) => {
    if (result.ok) done(t('console.website.restored'));
    else fail(result.error);
  });
  return { editor, blocks, setBlocks, token, saves, outcome, save, publish, restore };
}

/** The page's blocks in place, the draft saved and previewed, then published now or at a time; and its history. */
function Editor({ venueId, page, start, revisions }: { venueId: string; page: EditorPage; start: readonly EditorBlock[]; revisions: readonly SiteRevision[] }) {
  const draft = useDraft(venueId, page.pageId, start, revisions);
  return (
    <Stack gap={6}>
      {draft.blocks.map((block, index) => (
        <BlockEditor key={`${String(index)}-${block.kind}`} block={block} position={index + 1}
          onChange={(next) => draft.setBlocks((current) => current.map((each, place) => (place === index ? next : each)))} />
      ))}
      <Actions hasDraft={draft.token !== null} isSaving={draft.editor.save.isPending} isPublishing={draft.editor.publish.isPending}
        onSave={draft.save} onPublish={draft.publish} />
      <StatusMessage>{draft.outcome?.ok === true ? draft.outcome.text : null}</StatusMessage>
      {draft.outcome?.ok === false ? <ErrorMessage>{draft.outcome.text}</ErrorMessage> : null}
      <WebPreview label={t('console.website.preview', { page: page.title })} src={previewSrc(draft.token, draft.saves)}
        emptyText={WEB_URL === undefined ? t('console.website.noPreview') : t('console.website.saveToPreview')} />
      <RevisionHistory revisions={revisions} onRestore={draft.restore} />
    </Stack>
  );
}

/** A page in the website editor (#129): its draft, preview and history, once its blocks are read. */
export function PageEditor({ venueId, page }: { venueId: string; page: EditorPage }) {
  const state = useEditorPage(page.pageId);
  if (state.data === undefined) {
    return state.isError ? <ErrorMessage>{t('console.website.failures.unavailable')}</ErrorMessage> : <Text tone="muted">{t('common.loading')}</Text>;
  }
  return <Editor venueId={venueId} page={page} start={startingBlocks(state.data.blocks, state.data.revisions)} revisions={state.data.revisions} />;
}
