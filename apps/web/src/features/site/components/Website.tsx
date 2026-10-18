import type { SiteView } from '../loadPage.ts';
import { MissingPage } from './MissingPage.tsx';
import { SitePage } from './SitePage.tsx';

/** What the website shows for one request: the club's page, or why there is none. */
export function Website({ view }: { view: SiteView }) {
  if (view.page) return <SitePage page={view.page} playerUrl={view.playerUrl} attribution={view.attribution} />;
  return <MissingPage failed={view.status === 503} attribution={view.attribution} />;
}
