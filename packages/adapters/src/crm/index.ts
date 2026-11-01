export type { CrmAdapter, CrmContact } from './types.ts';
export { createHubSpotCrm, HUBSPOT_ID_PROPERTY, toHubSpotProperties, type HubSpotCrmOptions } from './hubspot.ts';
export { createFakeCrm, type FakeCrm } from './fake.ts';
export { createCrmConsumer, crmContactFrom, CRM_EVENT_TYPES, type FindCrmContact } from './consumer.ts';
