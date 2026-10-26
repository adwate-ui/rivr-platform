import { useFeature } from '@rivr/db';
import { useMyTdsCertificates, type TdsCertificate } from '@rivr/db/tds';
import { formatMoney, formatNumber, formatQuarter, t } from '@rivr/i18n';
import { FeatureGate, Heading, Screen, Stack, Text } from '@rivr/ui';

/** One quarter's TDS from one venue: when, who withheld it and their TAN, and how much from how many cash-outs. */
function Certificate({ certificate }: { certificate: TdsCertificate }) {
  return (
    <Stack gap={1}>
      <Text weight="medium">
        {t('player.sessions.tdsFrom', {
          quarter: formatQuarter(certificate.quarterStart), legalName: certificate.legalName, tan: certificate.tan ?? t('player.sessions.noTan'),
        })}
      </Text>
      <Text variant="small" tone="muted">
        {t('player.sessions.tdsAmount', { tds: formatMoney(certificate.tds), section: certificate.section, count: formatNumber(certificate.cashOuts) })}
      </Text>
    </Stack>
  );
}

/**
 * Sessions. The history is gated by tier (feature sessions.history), and lane C builds it out. TDS
 * certificate data (#93; decision 0169) shows whenever TDS was withheld from the member, whatever their
 * tier: a member is owed it.
 */
export function SessionsScreen() {
  const certificates = useMyTdsCertificates();
  const access = useFeature('sessions.history');
  const title = t('player.sessions.title');
  if (certificates.isError) return <Screen title={title} status="error" onRetry={() => void certificates.refetch()} />;
  if (certificates.data === undefined) return <Screen title={title} status="loading" />;
  if (certificates.data.length === 0) {
    return (
      <FeatureGate access={access}>
        <Screen title={title} status="empty" emptyText={t('player.sessions.empty')} />
      </FeatureGate>
    );
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Stack gap={4}>
          <Heading level={2}>{t('player.sessions.tds')}</Heading>
          <Stack gap={4} divided>
            {certificates.data.map((certificate) => (
              <Certificate key={`${certificate.venueId}:${certificate.quarterStart}:${certificate.section}`} certificate={certificate} />
            ))}
          </Stack>
        </Stack>
        <FeatureGate access={access}>
          <Text tone="muted">{t('player.sessions.empty')}</Text>
        </FeatureGate>
      </Stack>
    </Screen>
  );
}
