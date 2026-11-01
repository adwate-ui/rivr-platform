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

/** A template's budget, opened in place by Send for approval: the amount and what it covers, then Send or Cancel. */
function BudgetForm({ isSending, onSend, onCancel }: { isSending: boolean; onSend: (typed: { budget: TemplateSubmission['budget'] } | null) => void; onCancel: () => void }) {
  const [budget, setBudget] = useState('');
  const [period, setPeriod] = useState<Period>('promotion');
  return (
    <Stack gap={3}>
      <Inline gap={4} align="end" wrap>
        <Input label={t('console.promotions.budget')} value={budget} inputMode="decimal" autoComplete="off" onChange={(event) => setBudget(event.target.value)} />
        <ChoiceChips label={t('console.promotions.budgetFor')} mode="one" selected={[period]}
          options={PERIODS.map((value) => ({ value, label: t(`console.promotions.budgetPeriods.${value}`) }))}
          onChange={([picked]) => { const found = PERIODS.find((known) => known === picked); if (found) setPeriod(found); }} />
      </Inline>
      <Inline gap={3}>
        <Button variant="secondary" isLoading={isSending} onClick={() => onSend(budgetFrom(budget, period))}>{t('console.promotions.sendTemplate')}</Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** One template on one line, with Send for approval; its budget opens in place on that press (UI polish audit A-15). */
function TemplateRow({ venueId, template, onSubmitted }: { venueId: string; template: ConsolePromotion; onSubmitted: (name: string) => void }) {
  const { submitTemplate } = usePromotionActions(venueId);
  const [isOpen, setIsOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const nameId = useId();
  const line = [template.detail, template.runs].filter((part) => part !== null).join(' · ');
  const send = async (typed: { budget: TemplateSubmission['budget'] } | null) => {
    if (typed === null) {
      setFailure(t('console.promotions.invalidBudget'));
      return;
    }
    const result = await submitTemplate.mutateAsync({ id: template.id, budget: typed.budget });
    if (result.ok) onSubmitted(template.name);
    setFailure(result.ok ? null : t(`console.promotions.failures.${result.error}`));
  };
  return (
    <Stack gap={3}>
      <Inline justify="between" align="center" gap={6}>
        <Stack gap={1} grow>
          <Text weight="medium" id={nameId}>{template.name}</Text>
          {line === '' ? null : <Text variant="small" tone="muted">{line}</Text>}
        </Stack>
        {isOpen ? null : (
          <Button variant="text" onClick={() => setIsOpen(true)} aria-describedby={nameId}>{t('console.promotions.submitTemplate')}</Button>
        )}
      </Inline>
      {isOpen ? <BudgetForm isSending={submitTemplate.isPending} onSend={(typed) => void send(typed)} onCancel={() => { setIsOpen(false); setFailure(null); }} /> : null}
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
