import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT_KINDS, contactSchema } from '@rivr/contracts';
import { useIncidentActions, type Contact, type IncidentFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { failureText } from './incidentCopy.ts';

const KINDS = CONTACT_KINDS.map((value) => ({ value, label: t(`console.incidents.contactKinds.${value}`) }));

/** Adds a contact, for SOP managers. */
function AddContactForm({ venueId, onFailure }: { venueId: string; onFailure: (failure: IncidentFailure | null) => void }) {
  const { addContact } = useIncidentActions(venueId);
  const [resolver] = useState(() => zodResolver(contactSchema));
  const form = useForm<z.input<typeof contactSchema>, unknown, z.output<typeof contactSchema>>({
    resolver, defaultValues: { kind: 'escalation', name: '', role: '', phone: '' },
  });
  const submit = form.handleSubmit(async (contact) => {
    const added = await addContact.mutateAsync(contact);
    onFailure(added.ok ? null : added.error);
    if (added.ok) form.reset();
  });
  const fields = { name: form.register('name'), role: form.register('role'), phone: form.register('phone') };
  const isInvalid = form.formState.errors.name !== undefined || form.formState.errors.phone !== undefined;
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="kind" render={({ field }) => (
        <ChoiceChips label={t('console.incidents.contactKind')} mode="one" options={KINDS} selected={[field.value]}
          onChange={([picked]) => { if (picked) field.onChange(picked); }} />
      )} />
      <Inline gap={3} align="end" wrap>
        <Input {...fields.name} label={t('console.incidents.contactName')} autoComplete="off" />
        <Input {...fields.role} label={t('console.incidents.contactRole')} autoComplete="off" />
        <Input {...fields.phone} label={t('console.incidents.contactPhone')} type="tel" autoComplete="off"
          error={isInvalid ? t('console.incidents.invalidContact') : undefined} />
        <Button variant="secondary" isLoading={addContact.isPending} onClick={() => void submit()}>{t('console.incidents.addContact')}</Button>
      </Inline>
    </Stack>
  );
}

/** The club's contacts by kind, the escalation matrix in its order; SOP managers add and remove them. */
export function ContactList({ venueId, contacts, canManage }: { venueId: string; contacts: readonly Contact[]; canManage: boolean }) {
  const { removeContact } = useIncidentActions(venueId);
  const [failure, setFailure] = useState<IncidentFailure | null>(null);
  const remove = async (contactId: string) => {
    const removed = await removeContact.mutateAsync(contactId);
    setFailure(removed.ok ? null : removed.error);
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.incidents.contacts')}</Heading>
      {CONTACT_KINDS.filter((kind) => contacts.some((contact) => contact.kind === kind)).map((kind) => (
        <Stack key={kind} gap={2} divided>
          <Heading level={3}>{t(`console.incidents.contactKinds.${kind}`)}</Heading>
          {contacts.filter((contact) => contact.kind === kind).map((contact) => (
            <Inline key={contact.contactId} justify="between" align="center" wrap>
              <Stack gap={1}>
                <Text weight="semibold">{contact.role === '' ? contact.name : `${contact.name} · ${contact.role}`}</Text>
                {contact.notes === '' ? null : <Text variant="small" tone="muted">{contact.notes}</Text>}
              </Stack>
              <Inline gap={3} align="center">
                <Text>{contact.phone}</Text>
                {canManage ? (
                  <Button variant="text" onClick={() => void remove(contact.contactId)}>{t('console.incidents.removeContact', { name: contact.name })}</Button>
                ) : null}
              </Inline>
            </Inline>
          ))}
        </Stack>
      ))}
      {canManage ? <AddContactForm venueId={venueId} onFailure={setFailure} /> : null}
      {failure === null ? null : <ErrorMessage>{failureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
