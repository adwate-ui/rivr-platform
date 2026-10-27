import { usePromotionActions, usePromotionTemplates, type ConsolePromotion, type TemplateSubmission } from '@rivr/db';
import { parseRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text, LoadState } from '@rivr/ui';
import { useId, useState } from 'react';

type Period = 'promotion' | 'month';
const PERIODS: readonly Period[] = ['promotion', 'month'];

/** The typed budget as sent: none when nothing is typed, or null when the text is no amount. */
function budgetFrom(text: string, period: Period): { budget: TemplateSubmission['budget'] } | null {
  if (text.trim() === '') return { budget: null };
  const paise = parseRupees(text);
  return paise.ok ? { budget: { paise: paise.value, period } } : null;
}

function TemplateRow({ venueId, template, onSubmitted }: { venueId: string; template: ConsolePromotion; onSubmitted: (name: string) => void }) {
  const { submitTemplate } = usePromotionActions(venueId);
  const [budget, setBudget] = useState('');
  const [period, setPeriod] = useState<Period>('promotion');
  const [failure, setFailure] = useState<string | null>(null);
  const nameId = useId();
  const line = [template.detail, template.runs].filter((part) => part !== null).join(' · ');
  const submit = async () => {
    const typed = budgetFrom(budget, period);
    if (typed === null) {
      setFailure(t('console.promotions.invalidBudget'));
      return;
    }
    const result = await submitTemplate.mutateAsync({ id: template.id, budget: typed.budget });
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
      <Inline gap={4} align="end" wrap>
        <Input label={t('console.promotions.budget')} value={budget} inputMode="decimal" autoComplete="off" onChange={(event) => setBudget(event.target.value)} />
        <ChoiceChips label={t('console.promotions.budgetFor')} mode="one" selected={[period]}
          options={PERIODS.map((value) => ({ value, label: t(`console.promotions.budgetPeriods.${value}`) }))}
          onChange={([picked]) => { const found = PERIODS.find((known) => known === picked); if (found) setPeriod(found); }} />
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** Every scheme in the deck still a draft (#85), each sent for approval as it stands (#144), with an optional budget (#562). */
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
