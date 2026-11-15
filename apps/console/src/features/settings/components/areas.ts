/** Notices on members' Home (decision 0298), with the rules for staff with settings.manage. */
export const NOTICE_AREA = 'notices';

/**
 * Settings' own areas: the rules of the floor and of members, each in its groups (groups.ts), the notices, and the venue's
 * details and chips, for super admins. The money areas, chips among them, are hidden at the owner's word (29 Oct, #626,
 * decision 0284): no rupee, rake or reporting on any console. A rule set before stays in force; it is only not shown.
 */
export type SettingsArea = 'floor' | 'members' | 'club' | 'chips' | typeof NOTICE_AREA;
