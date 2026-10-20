import type { ContactKind, IncidentSeverity } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One of the venue's contacts (#53): the escalation matrix in its order, vendors, Glaza and the emergency lines. */
export interface Contact {
  readonly contactId: string;
  readonly kind: ContactKind;
  readonly name: string;
  readonly role: string;
  readonly phone: string;
  readonly notes: string;
}

/** An incident as logged, latest first: who logged it and the SOP it follows, by name. */
export interface Incident {
  readonly incidentId: string;
  readonly occurredAt: string;
  readonly severity: IncidentSeverity;
  readonly summary: string;
  readonly cctvReference: string | null;
  readonly sopTitle: string | null;
  readonly loggedByName: string | null;
}

/** A scheduled drill: the SOP it rehearses, and when it was held. */
export interface Drill {
  readonly drillId: string;
  readonly title: string;
  readonly sopTitle: string | null;
  readonly scheduledOn: string;
  readonly heldOn: string | null;
}

/** Why a change did not go through: not allowed, a value refused, a drill already held, the venue frozen, or anything else. */
export type IncidentFailure = 'not_allowed' | 'invalid' | 'held' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, IncidentFailure>> = { '42501': 'not_allowed', '23514': 'invalid', '22023': 'invalid', RVDUP: 'held', RVFRZ: 'paused' };

const failed = (error: { code: string }): Result<null, IncidentFailure> => err(FAILURE_BY_CODE[error.code] ?? 'unavailable');

/** The venue's contacts, by kind and then their order. */
export function useContacts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.contacts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await client.from('contact').select('id, kind, name, role, phone, notes')
        .eq('venue_id', venueId).order('kind').order('position').order('name');
      if (error) throw error;
      return data.map((row) => ({ contactId: row.id, kind: row.kind, name: row.name, role: row.role, phone: row.phone, notes: row.notes }));
    },
  });
}

/** The incidents the signed-in staff member may read at the venue: their own, or every one for SOP managers and the audit. */
export function useIncidents(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.incidents(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await client.from('incident')
        .select('id, occurred_at, severity, summary, cctv_reference, sop!incident_sop_id_venue_id_fkey(title), staff!incident_logged_by_staff_id_venue_id_fkey(full_name)')
        .eq('venue_id', venueId).order('occurred_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data.map((row) => ({
        incidentId: row.id, occurredAt: row.occurred_at, severity: row.severity, summary: row.summary, cctvReference: row.cctv_reference,
        sopTitle: row.sop?.title ?? null, loggedByName: row.staff?.full_name ?? null,
      }));
    },
  });
}

/** The venue's drills, by date. */
export function useDrills(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.drills(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Drill[]> => {
      const { data, error } = await client.from('drill').select('id, title, scheduled_on, held_on, sop!drill_sop_id_venue_id_fkey(title)')
        .eq('venue_id', venueId).order('scheduled_on').limit(100);
      if (error) throw error;
      return data.map((row) => ({ drillId: row.id, title: row.title, sopTitle: row.sop?.title ?? null, scheduledOn: row.scheduled_on, heldOn: row.held_on }));
    },
  });
}

/**
 * Staff `log` an incident; SOP managers `addContact` and `removeContact`, `scheduleDrills` (four, a quarter
 * apart) and `holdDrill`. Each resolves to a Result and reloads what it changed.
 */
export function useIncidentActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (key: readonly unknown[], error: { code: string } | null) => {
    await queryClient.invalidateQueries({ queryKey: key });
    return error ? failed(error) : ok(null);
  };
  const who = userId ?? 'signed-out';
  const log = useMutation({
    mutationFn: async (incident: { severity: IncidentSeverity; summary: string; cctvReference: string; sopId: string | null }) =>
      settle(queryKeys.incidents(who, venueId), (await client.from('incident').insert({
        venue_id: venueId, severity: incident.severity, summary: incident.summary.trim(),
        cctv_reference: incident.cctvReference.trim() || null, sop_id: incident.sopId,
      })).error),
  });
  const addContact = useMutation({
    mutationFn: async (contact: { kind: ContactKind; position: number; name: string; role: string; phone: string }) =>
      settle(queryKeys.contacts(who, venueId), (await client.from('contact').insert({ venue_id: venueId, ...contact })).error),
  });
  const removeContact = useMutation({
    mutationFn: async (contactId: string) => settle(queryKeys.contacts(who, venueId), (await client.from('contact').delete().eq('id', contactId)).error),
  });
  const scheduleDrills = useMutation({
    mutationFn: async ({ title, sopId, firstOn }: { title: string; sopId: string | null; firstOn: string }) =>
      settle(queryKeys.drills(who, venueId), (await client.rpc('schedule_drills', { p_venue_id: venueId, p_title: title, p_first_on: firstOn, ...(sopId === null ? {} : { p_sop_id: sopId }) })).error),
  });
  const holdDrill = useMutation({
    mutationFn: async (drillId: string) => settle(queryKeys.drills(who, venueId), (await client.rpc('hold_drill', { p_drill_id: drillId, p_notes: '' })).error),
  });
  return { log, addContact, removeContact, scheduleDrills, holdDrill };
}
