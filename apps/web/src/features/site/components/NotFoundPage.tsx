import { t } from '@rivr/i18n';
import { HeroBlock, WebShell } from '@rivr/ui';

/** An address the website does not have: a draft, or no such page. */
export function NotFoundPage() {
  return (
    <WebShell links={[]}>
      <HeroBlock heading={t('common.notFoundTitle')} text={t('common.notFound')} />
    </WebShell>
  );
}
