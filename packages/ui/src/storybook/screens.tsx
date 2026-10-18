/**
 * Sample screen content for the shell stories, so each shell is shown holding a realistic
 * screen. Apps compose their own screens from their own catalogue copy.
 */
import { Box } from '../Box/Box.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Stakes } from '../Stakes/Stakes.tsx';
import { Text } from '../Text/Text.tsx';

const TABLES = [
  { name: 'Table 1', small: 5_000n, big: 10_000n, open: 2 },
  { name: 'Table 2', small: 10_000n, big: 20_000n, open: 0 },
  { name: 'Table 3', small: 10_000n, big: 20_000n, open: 1 },
  { name: 'Private Room', small: 100_000n, big: 200_000n, open: 3 },
];

const seatsOpen = (count: number) => (count === 1 ? '1 seat open' : `${count} seats open`);
const OFFLINE = 'Offline. 3 hands queued.';

/** Tonight's tables as a divided list. */
export function TablesList() {
  return (
    <Stack as="ul" divided>
      {TABLES.map((table) => (
        <li key={table.name}>
          <Inline justify="between">
            <Stack gap={0}>
              <Text weight="medium">{table.name}</Text>
              <Stakes smallBlind={table.small} bigBlind={table.big} tone="muted" size="small" />
            </Stack>
            <Text variant="small" tone="muted">
              {seatsOpen(table.open)}
            </Text>
          </Inline>
        </li>
      ))}
    </Stack>
  );
}

/** The dealer tablet's slim offline banner. */
export function OfflineBanner() {
  return (
    <Box surface="raised" hairline="bottom" paddingX={6} paddingY={2}>
      <Inline gap={2}>
        <Icon name="offline" size="sm" />
        <Text variant="small">{OFFLINE}</Text>
      </Inline>
    </Box>
  );
}
