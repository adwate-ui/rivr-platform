import { z } from 'zod';

/** Who the club calls (#53), as public.contact_kind lists them: the escalation matrix first. */
export const CONTACT_KINDS = ['escalation', 'vendor', 'glaza', 'police', 'fire', 'electricity'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** How serious an incident is, as public.incident_severity lists them, least first. */
export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** A contact an SOP manager adds: a phone number as dialled, `+91 98765 43210` or a helpline such as `112`. */
export const contactSchema = z.object({
  kind: z.enum(CONTACT_KINDS),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ]{2,19}$/),
});

/** An incident as staff log it: the severity, what happened, the camera and time if one saw it, and the SOP followed. */
export const incidentSchema = z.object({
  severity: z.enum(INCIDENT_SEVERITIES),
  summary: z.string().trim().min(3).max(2000),
  cctvReference: z.string().trim().max(200),
  sopId: z.uuid().nullable(),
});

/** A drill scheduled four times, a quarter apart from its first date (`2026-11-20`). */
export const drillScheduleSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sopId: z.uuid().nullable(),
  firstOn: z.iso.date(),
});
