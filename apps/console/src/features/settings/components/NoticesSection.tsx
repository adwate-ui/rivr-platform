import { useNoticeActions, useVenueNotices, type NoticeFailure, type VenueNotice } from '@rivr/db/notices';
import { formatDateTime, t } from '@rivr/i18n';
import { Button, ConfirmButton, ErrorMessage, Heading, Inline, LoadState, Stack, StatusMessage, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';

type Outcome = { ok: boolean; text: string } | null;

/** One notice in force or to come: its words, until when, and End. */
function NoticeRow({ notice, onEnd, isBusy }: { notice: VenueNotice; onEnd: () => void; isBusy: boolean }) {
  const until = notice.endsAt === null ? t('console.settings.notices.untilEnded') : t('console.settings.notices.until', { date: formatDateTime(new Date(notice.endsAt)) });
  return (
    <Inline gap={4} justify="between" align="center">
      <Stack gap={1}>
        <Text>{notice.body}</Text>
        <Text tone="muted" variant="small">{until}</Text>
      </Stack>
      <ConfirmButton variant="secondary" label={t('console.settings.notices.end')} name={t('console.settings.notices.endName', { body: notice.body })}
        confirm={t('console.settings.notices.endConfirm')} isBusy={isBusy} onConfirm={onEnd} />
    </Inline>
  );
}

/**
 * Notices on members' Home (decision 0298): put one up, and end those up or to come. For staff with settings.manage;
 * the database refuses anyone else.
 */
export function NoticesSection({ venueId }: { venueId: string }) {
  const notices = useVenueNotices(venueId);
  const { post, end } = useNoticeActions(venueId);
  const [body, setBody] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const failed = (error: NoticeFailure) => ({ ok: false, text: t(`console.settings.notices.failures.${error}`) });
  const putUp = async () => {
    const done = await post.mutateAsync(body);
    setOutcome(done.ok ? { ok: true, text: t('console.settings.notices.posted') } : failed(done.error));
    if (done.ok) setBody('');
  };
  const endOne = async (noticeId: string) => {
    const done = await end.mutateAsync(noticeId);
    setOutcome(done.ok ? { ok: true, text: t('console.settings.notices.ended') } : failed(done.error));
  };
  return (
    <Stack gap={6}>
      <Heading level={2} variant="section">{t('console.settings.notices.title')}</Heading>
      {notices.data === undefined ? <LoadState isError={notices.isError} onRetry={() => void notices.refetch()} /> : null}
      {notices.data?.length === 0 ? <Text>{t('console.settings.notices.none')}</Text> : null}
      {notices.data?.map((notice) => <NoticeRow key={notice.noticeId} notice={notice} isBusy={end.isPending} onEnd={() => void endOne(notice.noticeId)} />)}
      <Stack gap={3}>
        <TextArea label={t('console.settings.notices.body')} hint={t('console.settings.notices.bodyHint')} value={body} rows={2}
          onChange={(event) => { setBody(event.target.value); setOutcome(null); }} />
        <Inline gap={4}>
          <Button variant="secondary" isLoading={post.isPending} onClick={() => void putUp()}>{t('console.settings.notices.post')}</Button>
        </Inline>
        <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
        {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      </Stack>
    </Stack>
  );
}
