import '../../../messages.ts';
import type { Attribution } from '@rivr/contracts';
import type { ClubContact } from '@rivr/db';
import { t } from '@rivr/i18n';
import { CookieBanner, HeroBlock, WebShell } from '@rivr/ui';
import { siteHref } from '../links.ts';
import { Footer, menuLinks, topBar } from './SitePage.tsx';

interface MissingPageProps {
  /** The content could not be read, rather than there being no such page. */
  failed: boolean;
  /** The codes of the link the visitor arrived by, kept on the way home. */
  attribution: Attribution | null;
  /** The player app's address, for the footer's member app link. */
  playerUrl: string;
  /** The club's numbers, for the top bar (decision 0582). */
  contact: ClubContact;
}

/** No page to show: a draft or an address the website does not have, or content that could not be read; the menu, and the way back to the front page (W-07). */
export function MissingPage({ failed, attribution, playerUrl, contact }: MissingPageProps) {
  const home = { label: t('web.backHome'), href: siteHref('home', attribution) };
  return (
    <WebShell links={menuLinks(attribution)} homeHref={siteHref('home', attribution)} topBar={topBar(playerUrl, attribution, contact)}
      footer={<Footer attribution={attribution} playerUrl={playerUrl} />} after={<CookieBanner />}>
      {failed ? (
        <HeroBlock heading={t('web.unavailableTitle')} text={t('web.unavailable')} action={home} />
      ) : (
        <HeroBlock heading={t('common.notFoundTitle')} text={t('common.notFound')} action={home} />
      )}
    </WebShell>
  );
}
