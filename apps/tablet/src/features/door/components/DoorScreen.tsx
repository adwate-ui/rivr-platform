import { useDoorScan } from '@rivr/db';
import { t } from '@rivr/i18n';
import { QrScanView, type QrScanResult } from '@rivr/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { scanResult } from './doorCopy.ts';
import { useCardScanner } from './useCardScanner.ts';

// What a scan did stays on screen this long, or until the next scan.
const RESULT_MS = 6_000;

/**
 * The door kiosk (#331, decision 0164): a member holds up their RIVR card to the camera, or to a card
 * scanner plugged in. The first scan checks them in, the next checks them out, and the kiosk says so,
 * or why not. One scan at a time.
 */
export function DoorScreen() {
  const scan = useDoorScan();
  const [result, setResult] = useState<QrScanResult | undefined>(undefined);
  const isScanning = useRef(false);
  const onCode = useCallback((code: string) => {
    if (isScanning.current) return;
    isScanning.current = true;
    void scan.mutateAsync(code).then((outcome) => {
      setResult(scanResult(outcome));
      isScanning.current = false;
    });
  }, [scan]);
  const { videoRef, cameraError } = useCardScanner(onCode);
  useEffect(() => {
    if (result === undefined) return undefined;
    const timer = setTimeout(() => setResult(undefined), RESULT_MS);
    return () => clearTimeout(timer);
  }, [result]);
  return (
    <QrScanView videoRef={videoRef} prompt={t('tablet.door.prompt')} result={result} scannerLabel={t('tablet.door.scanner')} onScannerCode={onCode}
      cameraError={cameraError ? t('tablet.door.noCamera') : undefined} />
  );
}
