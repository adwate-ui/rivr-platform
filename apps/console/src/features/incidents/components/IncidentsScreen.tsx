import { useContacts, useDrills, useIncidents, useSopLibrary, useStaffVenue, type Incident } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Screen, Stack, Text } from '@rivr/ui';
import { ContactList } from './ContactList.tsx';
import { DrillList } from './DrillList.tsx';
import { IncidentForm } from './IncidentForm.tsx';
import { incidentText } from './incidentCopy.ts';

/**
 * Incidents (#53; scope-v1 module 11): every staff member logs an incident and reads the club's contacts;
 * SOP managers read every incident, keep the contacts and schedule the drills.
 */
export function IncidentsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('incidents.log') && !permissions.includes('sops.manage')) {
    return <Screen title={t('console.incidents.title')} status="error" errorText={t('console.incidents.notAllowed')} />;
  }
  return <Incidents venueId={venueId} canManage={permissions.includes('sops.manage')} />;
}

function IncidentLog({ incidents }: { incidents: readonly Incident[] }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.incidents.incidents')}</Heading>
      {incidents.length === 0 ? <Text tone="muted">{t('console.incidents.noIncidents')}</Text> : null}
      <Stack gap={3} divided>
        {incidents.map((incident) => (
          <Stack key={incident.incidentId} gap={1}>
            <Text variant="small" tone="muted">{incidentText(incident)}</Text>
            <Text>{incident.summary}</Text>
            {incident.cctvReference === null ? null : <Text variant="small">{t('console.incidents.incidentCctv', { cctv: incident.cctvReference })}</Text>}
            {incident.sopTitle === null ? null : <Text variant="small">{t('console.incidents.incidentSop', { title: incident.sopTitle })}</Text>}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function Incidents({ venueId, canManage }: { venueId: string; canManage: boolean }) {
  const incidents = useIncidents(venueId);
  const contacts = useContacts(venueId);
  const drills = useDrills(venueId);
  const sops = useSopLibrary(venueId);
  const title = t('console.incidents.title');
  const queries = [incidents, contacts, drills, sops];
  if (queries.some((query) => query.isPending)) return <Screen title={title} status="loading" />;
  if (incidents.data === undefined || contacts.data === undefined || drills.data === undefined || sops.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <IncidentForm venueId={venueId} sops={sops.data} />
        <IncidentLog incidents={incidents.data} />
        <ContactList venueId={venueId} contacts={contacts.data} canManage={canManage} />
        <DrillList venueId={venueId} drills={drills.data} sops={sops.data} canManage={canManage} />
      </Stack>
    </Screen>
  );
}
