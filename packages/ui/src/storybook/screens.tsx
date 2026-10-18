/**
 * Sample screen content for the shell stories, in English and Hindi, so each shell is shown
 * holding a realistic screen. Apps compose their own screens from their own catalogue copy.
 */
import type { Locale } from '@rivr/i18n';
import { Box } from '../Box/Box.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Stakes } from '../Stakes/Stakes.tsx';
import { Text } from '../Text/Text.tsx';

const TABLES = [
  { name: { en: 'Table 1', hi: 'टेबल 1' }, small: 5_000n, big: 10_000n, open: 2 },
  { name: { en: 'Table 2', hi: 'टेबल 2' }, small: 10_000n, big: 20_000n, open: 0 },
  { name: { en: 'Table 3', hi: 'टेबल 3' }, small: 10_000n, big: 20_000n, open: 1 },
  { name: { en: 'Private Room', hi: 'प्राइवेट रूम' }, small: 100_000n, big: 200_000n, open: 3 },
];

const COPY = {
  en: {
    seatsOpen: (count: number) => `${count} seats open`,
    frozen: 'Venue frozen. Buy-ins and cash-outs are paused.',
    offline: 'Offline. 3 hands queued.',
  },
  hi: {
    seatsOpen: (count: number) => `${count} सीटें खाली`,
    frozen: 'वेन्यू रोका गया है। बाय-इन और कैश-आउट रुके हैं।',
    offline: 'ऑफ़लाइन। 3 हाथ कतार में।',
  },
};

/** Tonight's tables as a divided list. */
export function TablesList({ locale = 'en' }: { locale?: Locale }) {
  return (
    <Stack as="ul" divided>
      {TABLES.map((table) => (
        <li key={table.name.en}>
          <Inline justify="between">
            <Stack gap={0}>
              <Text weight="medium">{table.name[locale]}</Text>
              <Stakes smallBlind={table.small} bigBlind={table.big} tone="muted" size="small" />
            </Stack>
            <Text variant="small" tone="muted">
              {COPY[locale].seatsOpen(table.open)}
            </Text>
          </Inline>
        </li>
      ))}
    </Stack>
  );
}

/** The kill-switch banner as the shells' banner slot will hold it. */
export function FrozenBanner({ locale = 'en' }: { locale?: Locale }) {
  return (
    <Box surface="alert" paddingX={4} paddingY={2}>
      <Inline gap={2}>
        <Icon name="alert" size="sm" />
        <Text variant="small" tone="onAlert" weight="medium">
          {COPY[locale].frozen}
        </Text>
      </Inline>
    </Box>
  );
}

/** The dealer tablet's slim offline banner. */
export function OfflineBanner({ locale = 'en' }: { locale?: Locale }) {
  return (
    <Box surface="raised" hairline="bottom" paddingX={6} paddingY={2}>
      <Inline gap={2}>
        <Icon name="offline" size="sm" />
        <Text variant="small">{COPY[locale].offline}</Text>
      </Inline>
    </Box>
  );
}
