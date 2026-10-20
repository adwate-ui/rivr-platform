import type { Incident, IncidentFailure } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';

/** Why a change on the Incidents screen did not go through. */
export function failureText(failure: IncidentFailure): string {
  return t(`console.incidents.failures.${failure}`);
}

/** An incident's first line: its severity, when it happened, and who logged it. */
export function incidentText(incident: Incident): string {
  const at = new Date(incident.occurredAt);
  return t('console.incidents.incident', {
    severity: t(`console.incidents.severities.${incident.severity}`), time: `${formatDate(at)}, ${formatTime(at)}`, name: incident.loggedByName ?? '',
  });
}

/** A date as `20 Nov 2026`, from the database's `2026-11-20`. */
export function dayText(date: string): string {
  return formatDate(new Date(`${date}T12:00:00+05:30`));
}
