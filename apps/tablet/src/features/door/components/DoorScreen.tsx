import { useDoorScan } from '@rivr/db';
import { t } from '@rivr/i18n';
import { QrScanView, type QrScanResult } from '@rivr/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resultLastsMs, scanResult } from './doorCopy.ts';
import { useCardScanner } from './useCardScanner.ts';

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
    if (isScanning.current) return null;
    isScanning.current = true;
    return scan.mutateAsync(code).then((outcome) => {
      const said = scanResult(outcome);
      setResult(said);
      isScanning.current = false;
      return { mayRetry: said.isRefused };
    });
  }, [scan]);
  const { videoRef, cameraError, retryCamera } = useCardScanner(onCode);
  useEffect(() => {
    const lasts = result === undefined ? null : resultLastsMs(result);
    if (lasts === null) return undefined;
    const timer = setTimeout(() => setResult(undefined), lasts);
    return () => clearTimeout(timer);
  }, [result]);
  return (
    <QrScanView videoRef={videoRef} prompt={t('tablet.door.prompt')} help={t('tablet.door.help')} result={result} scannerLabel={t('tablet.door.scanner')} onScannerCode={(code) => void onCode(code)}
      cameraError={cameraError ? t('tablet.door.noCamera') : undefined} retryCameraLabel={t('tablet.door.retryCamera')} onRetryCamera={retryCamera} />
  );
}
