import { describe, expect, it } from 'vitest';
import { rosterShiftsSchema, staffAddSchema, staffJobTitleSchema } from './staff.ts';

describe('staffAddSchema', () => {
  it('reads a staff member with a job title separate from the role, and their number', () => {
    expect(staffAddSchema.parse({ fullName: ' Ayesha Thomas ', jobTitle: 'Floor supervisor', role: 'host', phone: '98765 43210' }))
      .toEqual({ fullName: 'Ayesha Thomas', jobTitle: 'Floor supervisor', role: 'host', phone: '+919876543210' });
  });

  it('takes no number as none for a dealer, who signs in with a PIN, and for no one else', () => {
    expect(staffAddSchema.parse({ fullName: 'Pema Lepcha', jobTitle: 'Dealer', role: 'dealer', phone: '' }).phone).toBeNull();
    expect(staffAddSchema.safeParse({ fullName: 'Karan Gill', jobTitle: 'Host', role: 'host', phone: '' }).success).toBe(false);
  });

  it('refuses a missing name or job title, a role that is not one of the seven, and a number that is not a mobile', () => {
    const good = { fullName: 'A', jobTitle: 'Host', role: 'host', phone: '9000000901' };
    expect(staffAddSchema.safeParse({ ...good, fullName: ' ' }).success).toBe(false);
    expect(staffAddSchema.safeParse({ ...good, jobTitle: '' }).success).toBe(false);
    expect(staffAddSchema.safeParse({ ...good, role: 'floor_supervisor' }).success).toBe(false);
    expect(staffAddSchema.safeParse({ ...good, phone: '12345' }).success).toBe(false);
    expect(staffJobTitleSchema.safeParse({ jobTitle: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('rosterShiftsSchema', () => {
  const good = { staffIds: ['00000000-0000-4000-8000-000000000104'], days: ['2026-11-16'], starts: ' 18:00 ', ends: '02:00' };

  it('reads staff, days and two times on the 24-hour clock', () => {
    expect(rosterShiftsSchema.parse(good)).toEqual({ ...good, starts: '18:00' });
    expect(rosterShiftsSchema.safeParse({ ...good, starts: '00:00', ends: '23:59' }).success).toBe(true);
  });

  it('refuses no one, no day, and a time that is not HH:MM', () => {
    expect(rosterShiftsSchema.safeParse({ ...good, staffIds: [] }).success).toBe(false);
    expect(rosterShiftsSchema.safeParse({ ...good, days: [] }).success).toBe(false);
    for (const time of ['24:00', '9:00', '18:60', '6pm', '']) expect(rosterShiftsSchema.safeParse({ ...good, ends: time }).success).toBe(false);
  });
});
