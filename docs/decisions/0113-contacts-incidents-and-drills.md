# 0113: Contacts, the incident log and drills

Date: 2026-10-20 · Task: #53 (scope-v1 module 11, "Fallback SOPs and POCs")

- **Contacts** (`contact`): the escalation matrix in its call order, then vendors, Glaza, police, fire and DHBVN. Every staff member reads them on the Incidents screen, and SOP managers (`sops.manage`) keep them. The seed has the public helplines (112, 101, 1912) and placeholders for vendors and Glaza.
- **Incidents.** Any staff member (`incidents.log`) logs one with its severity, the camera and time if one saw it, and the SOP from the venue's library.
  - The database sets who logged it and when, and keeps it as logged; a correction is a new incident.
  - Logging goes on while the venue is frozen.
  - `incident.logged` goes out.
  - The logger, SOP managers and the audit (`audit.read`) read it.
- **Drills.** SOP managers schedule a drill four times, a quarter apart, with the SOP it rehearses. They mark one held on or after its date. The outage drill itself is decision 0121's practice-venue freeze.
