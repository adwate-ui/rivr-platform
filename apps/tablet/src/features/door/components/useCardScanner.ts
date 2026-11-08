import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

// A frame is read four times a second, at no more than 640 pixels across: enough for a card held up close.
const READ_MS = 250;
const READ_WIDTH = 640;
// The same card read again within this long is the card still held up, not a second scan: a code stays
// the same for its whole window (30 seconds unless set).
const SAME_CARD_MS = 30_000;
// After a refusal the member is told to try again, so the same card is heard again this soon, and no sooner: one still held up
// is not sent four times a second.
const RETRY_MS = 3_000;

/** What became of a code the camera read: null when no scan was taken (one is still going), or when answered whether the card may be tried again soon. */
export type CodeHeard = Promise<{ readonly mayRetry: boolean }> | null;

/** The QR code in the video's current frame, drawn small onto the canvas to read; null when there is none. */
function readFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null || video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) return null;
  const scale = Math.min(1, READ_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
  return found?.data ?? null;
}

/** Opens the front camera into the video, or says it cannot; what it returns closes it, even if it is still opening. */
function startCamera(videoRef: RefObject<HTMLVideoElement | null>, onFail: () => void): () => void {
  let stream: MediaStream | null = null;
  let isClosed = false;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then((opened) => {
      stream = opened;
      if (isClosed) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      if (videoRef.current === null) return;
      videoRef.current.srcObject = opened;
      void videoRef.current.play();
    })
    .catch(onFail);
  return () => {
    isClosed = true;
    stream?.getTracks().forEach((track) => track.stop());
  };
}

/**
 * The door kiosk's camera (decision 0164): the front camera, facing the member, into the video the
 * scanner shows; each frame read for a QR code with jsQR, as Android's WebView cannot be relied on for
 * the browser's own barcode detection. `onCode` hears each card once while it is held up, or again soon after a refusal. `cameraError`
 * is true when the camera cannot start (no camera, or permission refused), and `retryCamera` asks for it again (F-145).
 */
export function useCardScanner(onCode: (code: string) => CodeHeard) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [cameraError, setCameraError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);
  useEffect(() => {
    let last = { card: '', at: 0, holdMs: SAME_CARD_MS };
    const canvas = document.createElement('canvas');
    const timer = setInterval(() => {
      const code = videoRef.current === null ? null : readFrame(videoRef.current, canvas);
      // A card's code names its member after RIVR (RIVR-58-…, owner 8 Nov); the same card held up, across a new code, is one scan.
      const card = code?.match(/^RIVR-(\d+)-/)?.[1] ?? code ?? '';
      if (code === null || (card === last.card && Date.now() - last.at < last.holdMs)) return;
      const heard = onCodeRef.current(code);
      // Not taken, so not remembered: the card is heard on a later frame.
      if (heard === null) return;
      const taken = { card, at: Date.now(), holdMs: SAME_CARD_MS };
      last = taken;
      void heard.then(({ mayRetry }) => { if (mayRetry) taken.holdMs = RETRY_MS; });
    }, READ_MS);
    const closeCamera = startCamera(videoRef, () => setCameraError(true));
    return () => {
      clearInterval(timer);
      closeCamera();
    };
  }, [attempt]);
  const retryCamera = useCallback(() => {
    setCameraError(false);
    setAttempt((count) => count + 1);
  }, []);
  return { videoRef, cameraError, retryCamera };
}
