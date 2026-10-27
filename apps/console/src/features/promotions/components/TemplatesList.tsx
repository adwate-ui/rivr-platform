import { usePromotionActions, usePromotionTemplates, type ConsolePromotion } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text, LoadState } from '@rivr/ui';
import { useId, useState } from 'react';

function TemplateRow({ venueId, template, onSubmitted }: { venueId: string; template: ConsolePromotion; onSubmitted: (name: string) => void }) {
  const { submitTemplate } = usePromotionActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const nameId = useId();
  const line = [template.detail, template.runs].filter((part) => part !== null).join(' · ');
  const submit = async () => {
    const result = await submitTemplate.mutateAsync(template.id);
    if (result.ok) onSubmitted(template.name);
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
  const [submitted, setSubmitted] = useState<string | null>(null);
  const heading = <Heading level={2} variant="section">{t('console.promotions.templates')}</Heading>;
  if (templates.data === undefined) {
    return (
      <Stack gap={4}>
        {heading}
        <LoadState isError={templates.isError} onRetry={() => void templates.refetch()} />
      </Stack>
    );
  }
  if (templates.data.length === 0 && submitted === null) return null;
  return (
    <Stack gap={4}>
      {heading}
      {submitted === null ? null : <Text>{t('console.promotions.templateSubmitted', { name: submitted })}</Text>}
      <Stack gap={4} divided>
        {templates.data.map((template) => <TemplateRow key={template.id} venueId={venueId} template={template} onSubmitted={setSubmitted} />)}
      </Stack>
    </Stack>
  );
}
