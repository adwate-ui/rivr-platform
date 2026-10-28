import type { Action, SizingBucket } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { Button, Heading, Stack, StatusMessage, Text } from '@rivr/ui';
import type { Marked, PadAnswer, Spot } from '../drill.ts';

/** Whose feedback it is: the book's, by its title, or RIVR Academy's when the engine wrote it (#136). */
export function feedbackLabel(isAuthored: boolean, bookTitle: string): string {
  return isAuthored ? bookTitle : t('player.learn.verdict.academyLabel');
}

/** An answer in words: "Raise · Large". */
function said(answer: { action: Action; sizing?: SizingBucket | undefined }): string {
  const action = t(`player.learn.actions.${answer.action}`);
  return answer.sizing === undefined ? action : `${action} · ${t(`player.learn.sizes.${answer.sizing}`)}`;
}

interface VerdictViewProps {
  spot: Spot;
  answer: PadAnswer;
  marked: Marked;
  /** The title, for feedback the book wrote; the engine's own is RIVR Academy's. */
  bookTitle: string;
  isLast: boolean;
  onNext: () => void;
}

/**
 * The verdict (#136): one of the seven classes, what the member said and what the book says, the feedback with whose it
 * is (the book's, or RIVR Academy's when the engine wrote it), and why: the principle, its reasoning and its page.
 */
export function VerdictView({ spot, answer, marked, bookTitle, isLast, onNext }: VerdictViewProps) {
  const { principle } = spot;
  return (
    <Stack gap={4}>
      <StatusMessage>{t(`player.learn.verdicts.${marked.grade.klass}`)}</StatusMessage>
      <Text>{t('player.learn.verdict.youSaid', { answer: said(answer) })}</Text>
      <Text>{t('player.learn.verdict.bookSays', { answer: said(spot.resolution.outcome) })}</Text>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{feedbackLabel(marked.explanation.authored, bookTitle)}</Text>
        <Text>{marked.explanation.text}</Text>
      </Stack>
      <Stack gap={1}>
        <Heading level={2}>{t('player.learn.verdict.why')}</Heading>
        <Text weight="medium">{principle.name}</Text>
        {principle.rationale === undefined ? null : <Text variant="small">{principle.rationale}</Text>}
        {principle.page_ref === undefined ? null : <Text variant="small" tone="muted">{t('player.learn.verdict.page', { page: String(principle.page_ref) })}</Text>}
      </Stack>
      <Button variant="primary" onClick={onNext}>{t(isLast ? 'player.learn.verdict.finish' : 'player.learn.verdict.next')}</Button>
    </Stack>
  );
}
