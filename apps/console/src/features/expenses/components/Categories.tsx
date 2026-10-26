import { zodResolver } from '@hookform/resolvers/zod';
import { expenseCategorySchema } from '@rivr/contracts/treasury';
import { useExpenseActions, type ExpenseCategory, type ExpenseFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EXPENSE_FAILURE_COPY } from './expenseCopy.ts';

/** A treasury manager's expense categories (#95): each adds up in its own expense account of the ledger. */
export function Categories({ venueId, categories }: { venueId: string; categories: readonly ExpenseCategory[] }) {
  const { addCategory } = useExpenseActions(venueId);
  const [failure, setFailure] = useState<ExpenseFailure | null>(null);
  const [resolver] = useState(() => zodResolver(expenseCategorySchema));
  const form = useForm<z.input<typeof expenseCategorySchema>, unknown, z.output<typeof expenseCategorySchema>>({ resolver, defaultValues: { name: '' } });
  const submit = form.handleSubmit(async ({ name }) => {
    const done = await addCategory.mutateAsync(name);
    setFailure(done.ok ? null : done.error);
    if (done.ok) form.reset();
  });
  const nameField = form.register('name');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.expenses.categories')}</Heading>
      {categories.length === 0 ? <Text tone="muted">{t('console.expenses.noCategories')}</Text> : (
        <Text>{categories.map((category) => category.name).join(' · ')}</Text>
      )}
      <Inline gap={4} align="end" wrap>
        <Input {...nameField} label={t('console.expenses.newCategory')} autoComplete="off"
          error={form.formState.errors.name ? t('console.expenses.invalidCategory') : undefined} />
        <Button isLoading={addCategory.isPending} onClick={() => void submit()}>{t('console.expenses.addCategory')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(EXPENSE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
