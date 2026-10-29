import '../../../messages.ts';
import type { Attribution } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { HeroBlock, WebShell } from '@rivr/ui';
import { siteHref } from '../links.ts';
import { Footer } from './SitePage.tsx';

interface MissingPageProps {
  /** The content could not be read, rather than there being no such page. */
  failed: boolean;
  /** The codes of the link the visitor arrived by, kept on the way home. */
  attribution: Attribution | null;
  /** The player app's address, for the footer's member app link. */
  playerUrl: string;
}

/** No page to show: a draft or an address the website does not have, or content that could not be read. */
export function MissingPage({ failed, attribution, playerUrl }: MissingPageProps) {
  return (
    <WebShell links={[]} homeHref={siteHref('home', attribution)} footer={<Footer attribution={attribution} playerUrl={playerUrl} />}>
      {failed ? (
        <HeroBlock heading={t('web.unavailableTitle')} text={t('web.unavailable')} />
      ) : (
        <HeroBlock heading={t('common.notFoundTitle')} text={t('common.notFound')} />
      )}
    </WebShell>
  );
}
