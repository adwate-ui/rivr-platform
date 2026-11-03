# 0308: No CRM, and the website's launch answers

Date: 3 Nov 2026. The owner's answers of 3 Nov to #658, #624 and #724.

- **No CRM (#797).** The HubSpot sync goes, which changes decision 0284's note "The CRM is HubSpot, not the console".
  - Removed: the `crm-sync` consumer and its schedule, the adapter (`@rivr/adapters/crm`), the contact it read (`crm_contact`), the queue that fed it (`queue_crm_sync`), and the `member.answers_saved` and `member.erased` events, which only it took.
  - Members are sent to no CRM. The console stays without CRM features.
  - The privacy notice no longer names HubSpot.
  - The function deployed on staging and the `HUBSPOT_ACCESS_TOKEN` secret are removed by hand (runbook).
- **Rake is allowed (#794).** "Is poker legal in Gurugram?", kept a draft until a lawyer read it (decision 0295), is published.
- **No Academy for now (#795).** The Academy page is unpublished. It was in no menu, and nothing links to it. Learn and Events stay off at launch (#651).
- Each website change applies only while the page reads as the website came with it, so a club's own words stay.
