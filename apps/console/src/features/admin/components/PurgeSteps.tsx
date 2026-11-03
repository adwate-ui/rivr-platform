import { useControlState, useOpenPurgeAsk, type PurgeAsk } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, LoadState, StepList, type Step, type StepState } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { ArchiveStep, AskForm, PurgeStep } from './PurgeParts.tsx';
import { useArchiveExport } from './useArchiveExport.ts';

/** A step's state: done, the one to do now when it is its turn, else still to come. */
const stateOf = (isDone: boolean, isTurn: boolean): StepState => {
  if (isDone) return 'done';
  return isTurn ? 'current' : 'next';
};

/** The open ask; the other's stays, with the purge's outcome under it, once the purge it allowed has closed it. */
function useShownAsk(venueId: string) {
  const ask = useOpenPurgeAsk(venueId);
  const [carried, setCarried] = useState<PurgeAsk | null>(null);
  if (ask.data && !ask.data.isMine && ask.data !== carried) setCarried(ask.data);
  return { ask, shown: ask.data ?? carried };
}

/** The ask, once frozen: the form, or who asked and why; loading or failed until it is read. */
function askContent(venueId: string, { ask, shown }: ReturnType<typeof useShownAsk>): ReactNode {
  if (shown !== null) return undefined;
  if (ask.isPending) return <LoadState />;
  if (ask.isError) return <LoadState isError onRetry={() => void ask.refetch()} />;
  return <AskForm venueId={venueId} />;
}

/** Step 2's words: who asked, at what time and why, or what the step asks for. */
function askDetail(shown: PurgeAsk | null): string {
  if (shown === null) return t('console.purge.askHint');
  const time = formatTime(new Date(shown.askedAt));
  return shown.isMine ? t('console.purge.askedByYou', { time }) : t('console.purge.askedBy', { name: shown.askedBy, time, reason: shown.reason });
}

/** A later step's button, shown disabled until the steps before it are done. */
const waiting = (label: string, isDanger = false) => <Button variant={isDanger ? 'danger' : 'subtle'} size="compact" isDisabled>{label}</Button>;

/** Step 1: the venue frozen on Kill switch, so nothing changes between the archive and the purge. */
function freezeStep(isFrozen: boolean): Step {
  return {
    title: t('console.purge.freezeTitle'), detail: isFrozen ? t('console.purge.frozen') : t('console.purge.freezeFirst'), state: stateOf(isFrozen, true),
    action: isFrozen ? undefined : <Button variant="subtle" size="compact" href="/kill-switch">{t('console.purge.openKillSwitch')}</Button>,
  };
}

/** Step 2: once frozen, another super admin's ask, or the form to ask. */
function askStep(venueId: string, asked: ReturnType<typeof useShownAsk>, isFrozen: boolean): Step {
  return {
    title: t('console.purge.askTitle'), detail: askDetail(asked.shown), state: stateOf(asked.shown !== null, isFrozen),
    action: isFrozen ? undefined : waiting(t('console.purge.ask')), content: isFrozen ? askContent(venueId, asked) : undefined,
  };
}

/** Step 3: the full archive, made and saved, once the other super admin has asked. */
function archiveStep(archive: ReturnType<typeof useArchiveExport>, isTurn: boolean, isDone: boolean): Step {
  return {
    title: t('console.purge.archiveTitle'), detail: t('console.purge.archiveDetail'), state: stateOf(isDone, isTurn),
    action: isTurn ? undefined : waiting(t('console.exportArchive.make')), content: isTurn ? <ArchiveStep archive={archive} /> : undefined,
  };
}

/** Step 4: what the purge deletes, the name typed, and the purge, once the archive is saved. */
function purgeStep(venueId: string, isTurn: boolean): Step {
  return {
    title: t('console.purge.purgeTitle'), detail: t('console.purge.purgeHint'), state: stateOf(false, isTurn),
    action: isTurn ? undefined : waiting(t('console.purge.purge'), true), content: isTurn ? <PurgeStep venueId={venueId} /> : undefined,
  };
}

/**
 * Purge's numbered steps (console v3; decision 0239): freeze the venue; another super admin asks for the purge (A4-13);
 * the full archive, made and saved; then the purge, its name typed. Each step's action stays disabled until the one
 * before it is done; the database refuses each out of turn anyway.
 */
export function PurgeSteps({ venueId }: { venueId: string }) {
  const { isVenueFrozen } = useControlState(venueId);
  const asked = useShownAsk(venueId);
  const archive = useArchiveExport(venueId);
  const isArchiveTurn = isVenueFrozen && asked.shown !== null && !asked.shown.isMine;
  const isArchived = isArchiveTurn && archive.state.status === 'done';
  const steps = [freezeStep(isVenueFrozen), askStep(venueId, asked, isVenueFrozen), archiveStep(archive, isArchiveTurn, isArchived), purgeStep(venueId, isArchived)];
  return <StepList look="cards" label={t('console.purge.stepsLabel')} steps={steps} />;
}
