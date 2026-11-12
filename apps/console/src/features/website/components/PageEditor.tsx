import { siteBlockSchema } from '@rivr/contracts';
import { istMoment } from '@rivr/contracts/tournaments';
import { useEditorPage, useSiteEditor, type EditorBlock, type EditorPage, type SiteEditFailure, type SiteRevision } from '@rivr/db/siteEditor';
import { formatDayTime, formatDuration, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Inline, Input, LoadState, Segmented, Stack, StatusMessage, Text, WebPreview } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { RevisionHistory } from './RevisionHistory.tsx';
import { AddAtEnd, Section } from './Section.tsx';
import { kindsFor, moved, newSection, retyped } from './sections.ts';

type Outcome = { ok: boolean; text: string } | null;
const WEB_URL = import.meta.env.VITE_WEB_URL;

/** A section of the draft with its own id, so moving or taking one out never gives another its place in the editor (#906). */
interface DraftSection {
  readonly id: number;
  readonly block: EditorBlock;
}

let lastSectionId = 0;
const draftSection = (block: EditorBlock): DraftSection => ({ id: (lastSectionId += 1), block });
const blocksOf = (sections: readonly DraftSection[]) => sections.map((section) => section.block);

/** A draft, or one scheduled: the version the editor works on. */
const isOpenVersion = (revision: SiteRevision) => revision.status === 'draft' || revision.status === 'scheduled';

/** The draft to edit: the page's draft or scheduled version if it has one, else what it shows now. */
function startingBlocks(blocks: readonly EditorBlock[], revisions: readonly SiteRevision[]): readonly EditorBlock[] {
  return revisions.find(isOpenVersion)?.blocks ?? blocks;
}

/** The preview's address for a draft's token, a new one each save so the frame reads it again. */
function previewSrc(token: string | null, saves: number): string | null {
  return WEB_URL === undefined || token === null ? null : `${WEB_URL}/preview/${token}?v=${String(saves)}`;
}

type View = 'edit' | 'preview';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** When the draft was last saved, kept up to the half minute. */
function SavedAgo({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.floor((now - new Date(at).getTime()) / 60_000);
  return <Text variant="small" tone="muted">{minutes < 1 ? t('console.website.savedJustNow') : t('console.website.savedAgo', { time: formatDuration(minutes * 60) })}</Text>;
}

/** Publishing at an IST day and 24-hour time, asked for only when wanted. */
function PublishLater({ canPublish, isPublishing, onPublish }: Pick<ActionsProps, 'canPublish' | 'isPublishing' | 'onPublish'>) {
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const isWhen = DAY.test(day) && TIME.test(time);
  return (
    <Inline gap={2} align="end" wrap>
      <Input type="date" label={t('console.website.publishOn')} value={day} onChange={(event) => setDay(event.target.value)} />
      <Input label={t('console.website.publishAt')} hint={t('console.website.timeHint')} value={time} inputMode="numeric" autoComplete="off"
        onChange={(event) => setTime(event.target.value.trim())} />
      <Button variant="subtle" isDisabled={!canPublish || !isWhen} isLoading={isPublishing} onClick={() => onPublish(istMoment(day, time))}>
        {t('console.website.schedule')}
      </Button>
    </Inline>
  );
}

interface ActionsProps {
  readonly canPublish: boolean;
  readonly isSaving: boolean;
  readonly isPublishing: boolean;
  readonly onSave: () => void;
  readonly onPublish: (when: Date | null) => void;
  readonly view: View;
  readonly onView: (view: View) => void;
  /** When the open draft was last saved; none without one. */
  readonly savedAt: string | undefined;
}

/** Saving the draft, publishing it now or later, and the fields or the preview: above the blocks, so a long page needs no scrolling to save (F-029). */
function Actions({ canPublish, isSaving, isPublishing, onSave, onPublish, view, onView, savedAt }: ActionsProps) {
  const [isLater, setLater] = useState(false);
  const views = [{ value: 'edit', label: t('console.website.viewEdit') }, { value: 'preview', label: t('console.website.viewPreview') }] as const;
  return (
    <Stack gap={3}>
      <Inline gap={2} align="center" wrap>
        <Button variant="subtle" isLoading={isSaving} onClick={onSave}>{t('console.website.save')}</Button>
        <Button variant="primary" isDisabled={!canPublish} isLoading={isPublishing} onClick={() => onPublish(null)}>{t('console.website.publish')}</Button>
        <Button variant="subtle" onClick={() => setLater(!isLater)}>{t('console.website.publishLater')}</Button>
        <Segmented label={t('console.website.view')} options={views} value={view} onChange={onView} />
        {savedAt === undefined ? null : <SavedAgo at={savedAt} />}
      </Inline>
      {isLater ? <PublishLater canPublish={canPublish} isPublishing={isPublishing} onPublish={onPublish} /> : null}
    </Stack>
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
  /** Whether the blocks here differ from the last save, kept by the page, which starts the editor again only when they do not. */
  readonly isEdited: boolean;
  readonly setEdited: (isEdited: boolean) => void;
  /** A newer version of the page came in while the blocks here were edited: they are kept, and this says so (F2-26). */
  readonly isBehind: boolean;
}

/** A time to publish at, or null to publish now: a time already past publishes now. */
const laterOrNow = (at: Date | null): Date | null => (at !== null && at.getTime() > Date.now() ? at : null);

/** The draft's sections, and what each one's menu does to them, or a new one at the end (#906): each marks the draft edited. */
function useSections(start: readonly EditorBlock[], setEdited: (isEdited: boolean) => void) {
  const [sections, setSections] = useState(() => start.map(draftSection));
  const change = (next: (current: readonly DraftSection[]) => readonly DraftSection[]) => {
    setSections((current) => [...next(current)]);
    setEdited(true);
  };
  const actionsFor = (id: number) => {
    const placeOf = (current: readonly DraftSection[]) => current.findIndex((section) => section.id === id);
    const replace = (make: (block: EditorBlock) => EditorBlock) => change((current) => current.map((section) => (section.id === id ? { id, block: make(section.block) } : section)));
    return {
      onChange: (next: EditorBlock) => replace(() => next),
      onRetype: (kind: string) => replace((block) => retyped(block, kind)),
      onMove: (by: -1 | 1) => change((current) => moved(current, placeOf(current), by)),
      onDelete: () => change((current) => (current.length > 1 ? current.filter((section) => section.id !== id) : current)),
      onAdd: (kind: string, where: 'above' | 'below') => change((current) => {
        const at = placeOf(current) + (where === 'below' ? 1 : 0);
        return [...current.slice(0, at), draftSection(newSection(kind)), ...current.slice(at)];
      }),
    };
  };
  const addAtEnd = (kind: string) => change((current) => [...current, draftSection(newSection(kind))]);
  return { sections, actionsFor, addAtEnd };
}

/** A page's draft in the editor: its blocks, its preview token and saves, what last happened, and saving, publishing and restoring. */
function useDraft({ venueId, page, start, revisions, setOutcome, isEdited, setEdited }: EditorProps) {
  const editor = useSiteEditor(venueId, page.pageId);
  const { sections, actionsFor, addAtEnd } = useSections(start, setEdited);
  const blocks = sections.map((section) => section.block);
  // The draft's preview token, and how many saves the preview has shown, so the frame reads it again after each.
  const [preview, setPreview] = useState({ token: revisions.find(isOpenVersion)?.previewToken ?? null, saves: 0 });
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
  const restore = (revision: SiteRevision) => void editor.rollback.mutateAsync(revision.revisionId).then((result) => {
    if (result.ok) done(t('console.website.restored'));
    else fail(result.error);
  }, () => fail('unavailable'));
  return {
    editor, sections, actionsFor, addAtEnd, canPublish: preview.token !== null && !isEdited, token: preview.token, saves: preview.saves, save, publish, restore,
  };
}

/** The page's blocks in place, the draft saved and previewed, then published now or at a time; and its history. */

function Editor(props: EditorProps) {
  const { page, revisions, outcome, isBehind } = props;
  const draft = useDraft(props);
  const [view, setView] = useState<View>('edit');
  return (
    <Stack gap={6}>
      <Box isStickyBar surface="raised" paddingY={3}>
        <Stack gap={2}>
          <Actions canPublish={draft.canPublish} isSaving={draft.editor.save.isPending} isPublishing={draft.editor.publish.isPending}
            onSave={draft.save} onPublish={draft.publish} view={view} onView={setView} savedAt={revisions.find(isOpenVersion)?.updatedAt} />
          <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
          {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
        </Stack>
      </Box>
      {isBehind ? <ErrorMessage>{t('console.website.newerVersion')}</ErrorMessage> : null}
      {view === 'edit' ? (
        <>
          {draft.sections.map((section, index) => (
            <Section key={section.id} block={section.block} position={index + 1} count={draft.sections.length} actions={draft.actionsFor(section.id)}
              kinds={{ add: kindsFor(blocksOf(draft.sections), null), change: kindsFor(blocksOf(draft.sections), section.block) }} />
          ))}
          <AddAtEnd kinds={kindsFor(blocksOf(draft.sections), null)} onAdd={draft.addAtEnd} />
        </>
      ) : (
        <WebPreview label={t('console.website.preview', { page: page.title })} src={previewSrc(draft.token, draft.saves)}
          emptyText={WEB_URL === undefined ? t('console.website.noPreview') : t('console.website.saveToPreview')} />
      )}
      <RevisionHistory revisions={revisions} onRestore={draft.restore} />
    </Stack>
  );
}

/** The newest version's key: a save, a publish or a rollback, here or anywhere, makes a new one, a draft saved over in place too. */
function versionOf(revisions: readonly SiteRevision[] | undefined): string {
  const latest = revisions?.[0];
  return latest === undefined ? 'none' : `${latest.revisionId}-${latest.status}-${latest.updatedAt}`;
}

/**
 * A page in the website editor (#129): its draft, preview and history, once its blocks are read. A new version starts the
 * editor again from what the page then holds, unless its blocks are edited: then the typing is kept and the editor says a
 * newer version came in (F2-26), as when a scheduled publish fires or another editor saves.
 */
export function PageEditor({ venueId, page }: { venueId: string; page: EditorPage }) {
  const state = useEditorPage(page.pageId);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isEdited, setEdited] = useState(false);
  const latest = versionOf(state.data?.revisions);
  const [startedFrom, setStartedFrom] = useState(latest);
  // As React's own pattern for state from a previous render: adopt the new version while nothing here is edited.
  if (latest !== startedFrom && !isEdited) setStartedFrom(latest);
  if (state.data === undefined) return <LoadState isError={state.isError} onRetry={() => void state.refetch()} />;
  return (
    <Editor key={startedFrom} venueId={venueId} page={page} start={startingBlocks(state.data.blocks, state.data.revisions)}
      revisions={state.data.revisions} outcome={outcome} setOutcome={setOutcome} isEdited={isEdited} setEdited={setEdited}
      isBehind={latest !== startedFrom} />
  );
}
