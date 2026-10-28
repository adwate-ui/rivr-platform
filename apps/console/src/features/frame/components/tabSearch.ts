/**
 * A screen's tab in its address (#605): `?tab=mis` as given, so a refresh, Back or a shared link opens it. Each route
 * with tabs validates its search with this; the screen opens its first tab for a name it does not have.
 */
export function tabSearchFrom(search: Record<string, unknown>): { tab?: string } {
  const tab = search['tab'];
  return typeof tab === 'string' ? { tab } : {};
}
