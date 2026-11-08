import type { Workflow } from '../types.ts';
import { ADMIN } from './admin.ts';
import { ARRIVAL } from './arrival.ts';
import { DEVICES } from './devices.ts';
import { FLOOR } from './floor.ts';
import { MARKETING } from './marketing.ts';
import { MEMBER } from './member.ts';
import { NIGHT } from './night.ts';

/** Every workflow the walks carry out, one walk each. */
export const WORKFLOWS: readonly Workflow[] = [...ARRIVAL, ...NIGHT, ...MEMBER, ...FLOOR, ...ADMIN, ...MARKETING, ...DEVICES];
