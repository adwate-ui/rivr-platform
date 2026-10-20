# 0113: Contacts, the incident log and drills

Date: 2026-10-20 · Task: #53 (scope-v1 module 11, "Fallback SOPs and POCs")

**Contacts.** The POC directory is `contact`, by kind:
- the internal escalation matrix, in the order people are called;
- vendors;
- Glaza;
- the police;
- the fire service;
- electricity (DHBVN).

Every staff member reads it on the console's Incidents screen, and SOP managers (`sops.manage`) keep it. The seed gives the club the public helplines (112, 101, DHBVN's 1912) and placeholders for vendors and Glaza until the club gives their numbers.

**Incidents.** Any staff member (`incidents.log`) logs an incident with its severity, the camera and time if a camera saw it, and the SOP it follows from the venue's library.
- The database records who logged it.
- It is kept exactly as logged: a correction is a new incident.
- Logging goes on while the venue is frozen, which is when incidents happen.
- Its logger, SOP managers and the audit (`audit.read`) read it; other staff don't.

**Drills.** SOP managers schedule a drill four times, a quarter apart from its first date, with the SOP it rehearses, and mark each one held. Every staff member sees the schedule. The outage drill itself is decision 0121's freeze of the practice venue.
