import { useT } from '@rivr/i18n';
import { Heading, Stack, Text, WebShell } from '@rivr/ui';

/**
 * The website's home page. Lane C replaces it with the page blocks marketing edits from the
 * console (hero, games and stakes, tournament calendar, live floor...).
 */
export function HomePage() {
  const t = useT();
  return (
    <WebShell links={[]}>
      <Stack gap={4}>
        <Heading level={1} variant="display">
          {t('ui.brand.label')}
        </Heading>
        <Text variant="lead">{t('web.opening')}</Text>
      </Stack>
    </WebShell>
  );
}
