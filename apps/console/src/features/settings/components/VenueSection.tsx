import { zodResolver } from '@hookform/resolvers/zod';
import { venueConfigSchema, type VenueConfigChange, type VenueConfigInput } from '@rivr/contracts/venueConfig';
import { useVenueConfig, useVenueConfigActions, type VenueConfig, type VenueConfigFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { venueFailureText } from './settingsCopy.ts';

/** The form's fields in order, each with its label (and hint). */
const FIELDS: readonly { readonly name: keyof VenueConfigInput; readonly label: MessageKey; readonly hint?: MessageKey }[] = [
  { name: 'legalName', label: 'console.settings.legalName' },
  { name: 'gstin', label: 'console.settings.gstin' },
  { name: 'tan', label: 'console.settings.tan', hint: 'console.settings.tanHint' },
  { name: 'address', label: 'console.settings.address' },
  { name: 'upiPayeeName', label: 'console.settings.upiPayeeName' },
  { name: 'upiVpa', label: 'console.settings.upiVpa' },
  { name: 'bankName', label: 'console.settings.bankName' },
  { name: 'bankAccountName', label: 'console.settings.bankAccountName' },
  { name: 'bankAccountNumber', label: 'console.settings.bankAccountNumber' },
  { name: 'bankIfsc', label: 'console.settings.bankIfsc' },
  { name: 'invoicePrefix', label: 'console.settings.invoicePrefix', hint: 'console.settings.invoicePrefixHint' },
  { name: 'staffIpAllowlist', label: 'console.settings.staffIpAllowlist', hint: 'console.settings.staffIpAllowlistHint' },
  { name: 'alertWhatsapp', label: 'console.settings.alertWhatsapp' },
];

/** The configuration as the form types it: empty for nothing, the networks separated by commas. */
const toInput = (config: VenueConfig): VenueConfigInput => ({
  legalName: config.legalName, gstin: config.gstin ?? '', tan: config.tan ?? '', address: config.address, upiPayeeName: config.upiPayeeName ?? '',
  upiVpa: config.upiVpa ?? '', bankName: config.bankName ?? '', bankAccountName: config.bankAccountName ?? '',
  bankAccountNumber: config.bankAccountNumber ?? '', bankIfsc: config.bankIfsc ?? '', invoicePrefix: config.invoicePrefix,
  staffIpAllowlist: config.staffIpAllowlist.join(', '), alertWhatsapp: config.alertWhatsapp ?? '',
});

function VenueForm({ venueId, config }: { venueId: string; config: VenueConfig }) {
  const { save } = useVenueConfigActions(venueId);
  const [resolver] = useState(() => zodResolver(venueConfigSchema));
  const form = useForm<VenueConfigInput, unknown, VenueConfigChange>({ resolver, defaultValues: toInput(config) });
  const [outcome, setOutcome] = useState<VenueConfigFailure | 'saved' | null>(null);
  const submit = form.handleSubmit(async (change) => {
    const done = await save.mutateAsync(change);
    setOutcome(done.ok ? 'saved' : done.error);
  });
  const errors = form.formState.errors;
  return (
    <Stack gap={4}>
      <Grid columns={2} gap={4}>
        {FIELDS.map((field) => (
          <Input key={field.name} {...form.register(field.name, { onChange: () => setOutcome(null) })} label={t(field.label)}
            hint={field.hint === undefined ? undefined : t(field.hint)} error={errors[field.name] ? t('console.settings.invalidVenueField') : undefined} />
        ))}
      </Grid>
      <Inline gap={4}>
        <Button variant="secondary" isLoading={save.isPending} onClick={() => void submit()}>{t('console.settings.saveVenue')}</Button>
        {outcome === 'saved' ? <Text variant="small">{t('console.settings.venueSaved')}</Text> : null}
      </Inline>
      {outcome !== null && outcome !== 'saved' ? <ErrorMessage>{venueFailureText(outcome)}</ErrorMessage> : null}
    </Stack>
  );
}

/** The venue configuration, for super admins (venue.configure): legal and payment details, networks, alerts. */
export function VenueSection({ venueId }: { venueId: string }) {
  const config = useVenueConfig(venueId);
  const notSuperAdmin = venueFailureText('not_allowed');
  return (
    <Stack gap={6}>
      <Heading level={2}>{t('console.settings.venue')}</Heading>
      <Text tone="muted">{t('console.settings.venueHint')}</Text>
      {config.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {config.isError && config.data === undefined ? (
        <Stack gap={3}>
          <ErrorMessage>{t('console.settings.loadFailed')}</ErrorMessage>
          <Button variant="text" onClick={() => void config.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {config.data === null ? <ErrorMessage>{notSuperAdmin}</ErrorMessage> : null}
      {config.data ? <VenueForm venueId={venueId} config={config.data} /> : null}
    </Stack>
  );
}
