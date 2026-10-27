import { usePromotionActions, usePromotionTemplates, type ConsolePromotion } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';

function TemplateRow({ venueId, template }: { venueId: string; template: ConsolePromotion }) {
  const { submitTemplate } = usePromotionActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const nameId = useId();
  const line = [template.detail, template.runs].filter((part) => part !== null).join(' · ');
  const submit = async () => {
    const result = await submitTemplate.mutateAsync(template.id);
    setFailure(result.ok ? null : t(`console.promotions.failures.${result.error}`));
  };
  return (
    <Stack gap={2}>
      <Inline justify="between" align="center" gap={6}>
        <Stack gap={1} grow>
          <Text weight="medium" id={nameId}>{template.name}</Text>
          {line === '' ? null : <Text variant="small" tone="muted">{line}</Text>}
        </Stack>
        <Button variant="text" isLoading={submitTemplate.isPending} onClick={() => void submit()} aria-describedby={nameId}>
          {t('console.promotions.submitTemplate')}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** Every scheme in the deck still a draft (#85), each sent for approval as it stands (#144). Nothing shows once none is. */
export function TemplatesList({ venueId }: { venueId: string }) {
  const templates = usePromotionTemplates(venueId);
  const heading = <Heading level={2} variant="section">{t('console.promotions.templates')}</Heading>;
  if (templates.data === undefined) {
    return (
      <Stack gap={4}>
        {heading}
        <Text tone="muted">{t(templates.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {templates.isError ? <Inline><Button onClick={() => void templates.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  if (templates.data.length === 0) return null;
  return (
    <Stack gap={4}>
      {heading}
      <Stack gap={4} divided>
        {templates.data.map((template) => <TemplateRow key={template.id} venueId={venueId} template={template} />)}
      </Stack>
    </Stack>
  );
}
