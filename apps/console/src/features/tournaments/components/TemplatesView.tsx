import type { BlindStructure, TournamentTemplate } from '@rivr/db';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Grid, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { TemplateForm } from './TemplateForm.tsx';

function templateColumns(structures: readonly BlindStructure[], onEdit: (template: TournamentTemplate) => void): DataTableColumn<TournamentTemplate>[] {
  const structureName = (row: TournamentTemplate) => structures.find((structure) => structure.id === row.structureId)?.name ?? '';
  return [
    { key: 'name', header: t('console.tournaments.name'), cell: (row) => row.name },
    { key: 'format', header: t('console.tournaments.format'), cell: (row) => t(`console.tournaments.formats.${row.format}`) },
    { key: 'buyIn', header: t('console.tournaments.buyInLabel'), align: 'end', cell: (row) => formatMoney(row.buyIn) },
    { key: 'stack', header: t('console.tournaments.stackColumn'), align: 'end', cell: (row) => formatNumber(row.startingStack) },
    { key: 'structure', header: t('console.tournaments.structure'), cell: structureName },
    { key: 'registration', header: t('console.tournaments.registrationColumn'), cell: (row) => t('console.tournaments.toLevel', { level: row.lastRegistrationLevel }) },
    { key: 'paid', header: t('console.tournaments.paidColumn'), cell: (row) => t('console.tournaments.placesPaid', { count: row.placesPaid }) },
    {
      key: 'edit', header: t('console.tournaments.edit'), align: 'end',
      cell: (row) => (
        <Button variant="text" aria-label={t('console.tournaments.editName', { name: row.name })} onClick={() => onEdit(row)}>{t('console.tournaments.edit')}</Button>
      ),
    },
  ];
}

/** The venue's tournament templates (#115, #116), and the form for a new one or the one chosen. */
export function TemplatesView({ venueId, templates, structures }: { venueId: string; templates: readonly TournamentTemplate[]; structures: readonly BlindStructure[] }) {
  const [editing, setEditing] = useState<TournamentTemplate | null>(null);
  return (
    <Grid columns={2} gap={12}>
      <DataTable label={t('console.tournaments.templates')} columns={templateColumns(structures, setEditing)} rowKey={(row) => row.id} rows={templates}
        emptyText={t('console.tournaments.noTemplateList')} />
      <TemplateForm key={editing?.id ?? 'new'} venueId={venueId} template={editing} structures={structures} onDone={() => setEditing(null)} />
    </Grid>
  );
}
