/** What the harness needs from `supabase status -o json` for the copy's stack. */
export interface StackStatus {
  apiUrl: string;
  dbUrl: string;
  publishableKey: string;
  /** The local stack's own service-role key. Never printed, never written to a file. */
  serviceRoleKey: string;
}

function readString(value: object, key: string): string {
  const field: unknown = Reflect.get(value, key);
  if (typeof field !== 'string' || field === '') throw new Error(`supabase status has no ${key}`);
  return field;
}

export function parseStatus(json: string): StackStatus {
  const value: unknown = JSON.parse(json);
  if (typeof value !== 'object' || value === null) throw new Error('supabase status did not print an object');
  return {
    apiUrl: readString(value, 'API_URL'),
    dbUrl: readString(value, 'DB_URL'),
    publishableKey: readString(value, 'PUBLISHABLE_KEY'),
    serviceRoleKey: readString(value, 'SERVICE_ROLE_KEY'),
  };
}
