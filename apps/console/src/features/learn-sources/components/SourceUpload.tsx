import { hashSource } from '@rivr/drills';
import { checkEncoding, type EncodingCheck } from '@rivr/drills/gates';
import { useAddLearnSource } from '@rivr/db/learnSources';
import { formatDate, t } from '@rivr/i18n';
import { Button, CameraButton, ErrorMessage, Heading, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

const SOURCE_KEY = /^[a-z0-9_-]{1,60}$/;
/** The report lines shown under a refusal: enough to see why. */
const REPORT_LINES = 40;

/** An encoding read and checked: its text and what the validator and the gates found. */
interface Checked {
  readonly raw: string;
  readonly check: EncodingCheck;
}

/** The check's verdict: passed with the title, refused with the gates and the start of the report, or an id no key can take. */
function Verdict({ checked }: { checked: Checked }) {
  const { check } = checked;
  if (!check.passed) {
    return (
      <Stack gap={1}>
        <ErrorMessage>{t('console.learnSources.refused', { failed: check.failed.join(', ') })}</ErrorMessage>
        {check.lines.slice(0, REPORT_LINES).map((line, index) => <Text key={`${String(index)}-${line}`} variant="small" tone="muted">{line}</Text>)}
      </Stack>
    );
  }
  if (!SOURCE_KEY.test(check.source?.id ?? '')) return <ErrorMessage>{t('console.learnSources.badKey')}</ErrorMessage>;
  return <StatusMessage>{t('console.learnSources.passed', { title: check.source?.title ?? '' })}</StatusMessage>;
}

/** The encoding's source once it passed and its id can be a key; null otherwise. */
function acceptedSource(checked: Checked | null): EncodingCheck['source'] {
  if (checked === null || !checked.check.passed) return null;
  return SOURCE_KEY.test(checked.check.source?.id ?? '') ? checked.check.source : null;
}

/** Reads a chosen file and runs the validator and the gates on it. */
function useEncodingCheck() {
  const [checked, setChecked] = useState<Checked | null>(null);
  const [isChecking, setChecking] = useState(false);
  const read = (file: File) => {
    setChecking(true);
    void file.text().then((raw) => {
      // The gates take a second or two: let the checking line show before they run.
      setTimeout(() => {
        setChecked({ raw, check: checkEncoding(raw) });
        setChecking(false);
      }, 0);
    });
  };
  return { checked, isChecking, read, clear: () => setChecked(null) };
}

interface LicenceFormProps {
  venueId: string;
  checked: Checked;
  source: NonNullable<EncodingCheck['source']>;
  onAdded: (text: string) => void;
}

/** The licence for an encoding that passed, its terms and last day, then the upload. */
function LicenceForm({ venueId, checked, source, onAdded }: LicenceFormProps) {
  const add = useAddLearnSource(venueId);
  const [endsOn, setEndsOn] = useState('');
  const [terms, setTerms] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const upload = () => void add.mutateAsync({
    raw: checked.raw, sourceKey: source.id, sourceHash: hashSource(JSON.parse(checked.raw)), title: source.title, author: source.author,
    licenceTerms: terms.trim(), licenceEndsOn: endsOn,
  }).then((done) => {
    setFailure(done.ok ? null : t(`console.learnSources.failures.${done.error}`));
    if (done.ok) onAdded(t('console.learnSources.added', { title: source.title, date: formatDate(new Date(endsOn)) }));
  });
  return (
    <>
      <Input type="date" label={t('console.learnSources.licenceEndsLabel')} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
      <Input label={t('console.learnSources.licenceTerms')} value={terms} maxLength={2000} autoComplete="off" onChange={(event) => setTerms(event.target.value)} />
      <Button variant="primary" isDisabled={endsOn === '' || terms.trim().length < 3} isLoading={add.isPending} onClick={upload}>
        {t('console.learnSources.upload')}
      </Button>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </>
  );
}

/**
 * Adding a licensed encoding (#131): the file is read here and the drill engine's validator and all eight gates
 * run on it (decision 0016); only one that passes, with licence terms and the licence's last day, is uploaded.
 */
export function SourceUpload({ venueId }: { venueId: string }) {
  const encoding = useEncodingCheck();
  const [added, setAdded] = useState<string | null>(null);
  const source = acceptedSource(encoding.checked);
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.learnSources.addTitle')}</Heading>
      <Text variant="small" tone="muted">{t('console.learnSources.hint')}</Text>
      <CameraButton camera="none" accept="application/json,.json" variant="secondary" isLoading={encoding.isChecking}
        onPhoto={(file) => { setAdded(null); encoding.read(file); }}>
        {t('console.learnSources.choose')}
      </CameraButton>
      <StatusMessage>{encoding.isChecking ? t('console.learnSources.checking') : null}</StatusMessage>
      {encoding.checked === null ? null : <Verdict checked={encoding.checked} />}
      {encoding.checked === null || source === null ? null : (
        <LicenceForm key={encoding.checked.raw.length} venueId={venueId} checked={encoding.checked} source={source}
          onAdded={(text) => { setAdded(text); encoding.clear(); }} />
      )}
      <StatusMessage>{added}</StatusMessage>
    </Stack>
  );
}
