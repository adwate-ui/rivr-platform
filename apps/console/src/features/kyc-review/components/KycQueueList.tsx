import type { KycCheck } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Box, Button, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId } from 'react';
import { checkGroups, queueLine } from './checkText.ts';

interface GroupProps {
  heading: string;
  checks: readonly KycCheck[];
  chosenId: string | null;
  onChoose: (memberId: string) => void;
  /** What the group says when it holds none; a group without one is left out while empty. */
  emptyText?: string;
}

/** One group of the queue, a region named by its heading, with its count and a row per check that opens it. */
function Group({ heading, checks, chosenId, onChoose, emptyText }: GroupProps) {
  const headingId = useId();
  if (checks.length === 0 && emptyText === undefined) return null;
  return (
    <Box as="section" aria-labelledby={headingId}>
      <Stack gap={2}>
        <Inline gap={3} justify="between">
          <Heading level={2} variant="subsection" id={headingId}>{heading}</Heading>
          <Text variant="small" tone="muted">{formatNumber(checks.length)}</Text>
        </Inline>
        {checks.length === 0 ? <Text variant="small" tone="muted">{emptyText}</Text> : null}
        {checks.map((check) => (
          <Button key={check.memberId} variant="text" size="compact" fullWidth isPressed={check.memberId === chosenId}
            aside={<Text variant="small" tone="muted">{queueLine(check)}</Text>} onClick={() => onChoose(check.memberId)}>
            {check.fullName}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

interface KycQueueListProps {
  checks: readonly KycCheck[];
  chosenId: string | null;
  onChoose: (memberId: string) => void;
}

/**
 * The queue down the left of KYC review (console v3): the checks to review, those waiting on the member, and those refused
 * in the last 90 days, each group with its count; the check open is marked.
 */
export function KycQueueList({ checks, chosenId, onChoose }: KycQueueListProps) {
  const groups = checkGroups(checks);
  const shared = { chosenId, onChoose };
  return (
    <Box surface="raised" radius="md" padding={4}>
      <Stack gap={6}>
        <Group heading={t('console.kycReview.waiting')} checks={groups.toReview} emptyText={t('console.kycReview.empty')} {...shared} />
        <Group heading={t('console.kycReview.onMember')} checks={groups.onMember} {...shared} />
        <Group heading={t('console.kycReview.refused')} checks={groups.refused} {...shared} />
      </Stack>
    </Box>
  );
}
