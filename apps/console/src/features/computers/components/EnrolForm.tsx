import { zodResolver } from '@hookform/resolvers/zod';
import { computerEnrolSchema } from '@rivr/contracts';
import { useEnrolComputer, type ComputerFailure, type ComputerKind } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<ComputerFailure, MessageKey>> = {
  not_allowed: 'console.computers.notAllowedAction',
  paused: 'console.computers.paused',
  invalid: 'console.computers.invalid',
  unavailable: 'console.computers.unavailable',
};

/** Enrols this computer by name, as the cage or an admin console; the browser keeps its token from then on. */
export function EnrolForm({ venueId }: { venueId: string }) {
  const enrol = useEnrolComputer(venueId);
  const [failure, setFailure] = useState<ComputerFailure | null>(null);
  const [resolver] = useState(() => zodResolver(computerEnrolSchema));
  const form = useForm<z.input<typeof computerEnrolSchema>, unknown, z.output<typeof computerEnrolSchema>>({
    resolver, defaultValues: { name: '' },
  });
  const enrolAs = (kind: ComputerKind) => form.handleSubmit(async ({ name }) => {
    const enrolled = await enrol.mutateAsync({ kind, name });
    setFailure(enrolled.ok ? null : enrolled.error);
    if (enrolled.ok) form.reset();
  });
  const nameField = form.register('name');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input {...nameField} label={t('console.computers.name')} hint={t('console.computers.nameHint')} autoComplete="off"
          error={form.formState.errors.name ? t('console.computers.invalid') : undefined} />
        <Button variant="secondary" isLoading={enrol.isPending} onClick={() => void enrolAs('cage')()}>{t('console.computers.enrolCage')}</Button>
        <Button variant="secondary" isLoading={enrol.isPending} onClick={() => void enrolAs('console')()}>{t('console.computers.enrolConsole')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
