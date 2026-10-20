import { zodResolver } from '@hookform/resolvers/zod';
import { computerEnrolSchema, devicePairSchema } from '@rivr/contracts';
import { useComputerActions, type ComputerCode, type ComputerFailure, type ComputerKind } from '@rivr/db';
import { formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<ComputerFailure, MessageKey>> = {
  not_allowed: 'console.computers.notAllowedAction',
  paused: 'console.computers.paused',
  invalid: 'console.computers.invalid',
  wrong_code: 'console.computers.wrongCode',
  too_many: 'console.computers.tooMany',
  unavailable: 'console.computers.unavailable',
};

/** Adds a computer by name, as the cage or an admin console, and shows the code to enter on it. */
export function AddComputerForm({ venueId }: { venueId: string }) {
  const { add } = useComputerActions(venueId);
  const [failure, setFailure] = useState<ComputerFailure | null>(null);
  const [code, setCode] = useState<ComputerCode | null>(null);
  const [resolver] = useState(() => zodResolver(computerEnrolSchema));
  const form = useForm<z.input<typeof computerEnrolSchema>, unknown, z.output<typeof computerEnrolSchema>>({ resolver, defaultValues: { name: '' } });
  const addAs = (kind: ComputerKind) => form.handleSubmit(async ({ name }) => {
    const added = await add.mutateAsync({ kind, name });
    setFailure(added.ok ? null : added.error);
    setCode(added.ok ? added.value : null);
    if (added.ok) form.reset();
  });
  const nameField = form.register('name');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end" wrap>
        <Input {...nameField} label={t('console.computers.name')} hint={t('console.computers.nameHint')} autoComplete="off"
          error={form.formState.errors.name ? t('console.computers.invalid') : undefined} />
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void addAs('cage')()}>{t('console.computers.addCage')}</Button>
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void addAs('console')()}>{t('console.computers.addConsole')}</Button>
      </Inline>
      {code === null ? null : <Text>{t('console.computers.code', { code: code.code, time: formatTime(new Date(code.expiresAt)) })}</Text>}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}

/** Enrols this computer with the code an admin console gave for it: the browser keeps its token from then on. */
export function EnrolForm({ venueId }: { venueId: string }) {
  const { enrol } = useComputerActions(venueId);
  const [failure, setFailure] = useState<ComputerFailure | null>(null);
  const [resolver] = useState(() => zodResolver(devicePairSchema));
  const form = useForm<z.input<typeof devicePairSchema>, unknown, z.output<typeof devicePairSchema>>({ resolver, defaultValues: { code: '' } });
  const submit = form.handleSubmit(async ({ code }) => {
    const enrolled = await enrol.mutateAsync(code);
    setFailure(enrolled.ok ? null : enrolled.error);
    if (enrolled.ok) form.reset();
  });
  const codeField = form.register('code');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input {...codeField} label={t('console.computers.enrolCode')} inputMode="numeric" autoComplete="off"
          error={form.formState.errors.code ? t('console.computers.wrongCode') : undefined} />
        <Button variant="secondary" isLoading={enrol.isPending} onClick={() => void submit()}>{t('console.computers.enrol')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
