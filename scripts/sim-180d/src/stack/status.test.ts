import { describe, expect, it } from 'vitest';
import { parseStatus } from './status.ts';

const STATUS = {
  API_URL: 'http://127.0.0.1:55721',
  DB_URL: 'postgresql://postgres:postgres@127.0.0.1:55722/postgres',
  PUBLISHABLE_KEY: 'sb_publishable_x',
  SERVICE_ROLE_KEY: 'service-role-x',
};

describe('parseStatus', () => {
  it('reads the URLs and keys', () => {
    expect(parseStatus(JSON.stringify(STATUS))).toEqual({
      apiUrl: STATUS.API_URL,
      dbUrl: STATUS.DB_URL,
      publishableKey: STATUS.PUBLISHABLE_KEY,
      serviceRoleKey: STATUS.SERVICE_ROLE_KEY,
    });
  });

  it('refuses a status without a key', () => {
    expect(() => parseStatus(JSON.stringify({ ...STATUS, SERVICE_ROLE_KEY: '' }))).toThrow('SERVICE_ROLE_KEY');
  });

  it('refuses anything but an object', () => {
    expect(() => parseStatus('null')).toThrow('did not print an object');
  });
});
