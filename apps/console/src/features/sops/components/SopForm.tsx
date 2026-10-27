import { zodResolver } from '@hookform/resolvers/zod';
import { sopSchema, STAFF_ROLES } from '@rivr/contracts';
import { useSopActions, type Sop, type SopFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { roleName, sopFailureText } from './sopCopy.ts';

type SopValues = z.input<typeof sopSchema>;

interface SopFormProps {
  venueId: string;
  /** The SOP to publish a new version of, starting from its latest version, waiting or in force; none to add an SOP. */
  sop?: Sop;
  /** Closes the form, after a publish or on Cancel. */
  onDone: () => void;
}

const EMPTY: SopValues = { title: '', owner: '', ackRoles: [], effectiveOn: '', body: '' };

/** A new SOP starts empty; a new version starts from the version waiting for its day, else the one in force. */
function startingValues(sop: Sop | undefined): SopValues {
  if (sop === undefined) return EMPTY;
  // The latest published: the last waiting for its day (a later version never takes effect before an earlier one), or the one in force.
  const latest = sop.waiting.at(-1) ?? sop.current;
  if (latest === null) return { ...EMPTY, title: sop.title };
  return { title: sop.title, owner: latest.owner, ackRoles: [...latest.ackRoles], effectiveOn: '', body: latest.body };
}

/**
 * Adds an SOP with its first version, or publishes a new version of one: the owner, the roles that
 * must acknowledge it, the day it takes effect and its text. For staff with sops.manage.
 */
export function SopForm({ venueId, sop, onDone }: SopFormProps) {
  const { add, publish } = useSopActions(venueId);
  const [failure, setFailure] = useState<SopFailure | null>(null);
  const [resolver] = useState(() => zodResolver(sopSchema));
  const form = useForm<SopValues, unknown, z.output<typeof sopSchema>>({ resolver, defaultValues: startingValues(sop) });
  const isSaving = add.isPending || publish.isPending;
  const save = form.handleSubmit(async ({ title, ...version }) => {
    const saved = sop === undefined ? await add.mutateAsync({ title, ...version }) : await publish.mutateAsync({ sopId: sop.sopId, ...version });
    setFailure(saved.ok ? null : saved.error);
    if (saved.ok) onDone();
  });
  const fields = { title: form.register('title'), owner: form.register('owner'), effectiveOn: form.register('effectiveOn'), body: form.register('body') };
  return (
    <Stack gap={4}>
      {sop === undefined ? <Input {...fields.title} label={t('console.sops.sopTitle')} autoComplete="off" /> : null}
      <Input {...fields.owner} label={t('console.sops.owner')} hint={t('console.sops.ownerHint')} autoComplete="off" />
      <Controller control={form.control} name="ackRoles" render={({ field }) => (
        <ChoiceChips label={t('console.sops.ackRoles')} selected={field.value} onChange={field.onChange}
          options={STAFF_ROLES.map((role) => ({ value: role, label: roleName(role) }))} />
      )} />
      <Input {...fields.effectiveOn} type="date" label={t('console.sops.effectiveOn')} hint={t('console.sops.effectiveOnHint')} />
      <TextArea {...fields.body} label={t('console.sops.body')} hint={t('console.sops.bodyHint')} rows={10} />
      {Object.keys(form.formState.errors).length > 0
        ? <ErrorMessage>{t(sop === undefined ? 'console.sops.invalid' : 'console.sops.invalidVersion')}</ErrorMessage>
        : null}
      {failure === null ? null : <ErrorMessage>{sopFailureText(failure)}</ErrorMessage>}
      <Inline gap={3}>
        <Button variant="primary" isLoading={isSaving} onClick={() => void save()}>
          {t(sop === undefined ? 'console.sops.addSop' : 'console.sops.publish')}
        </Button>
        <Button variant="secondary" onClick={onDone}>{t('console.sops.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
