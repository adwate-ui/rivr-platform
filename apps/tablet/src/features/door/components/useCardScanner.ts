import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

// A frame is read four times a second, at no more than 640 pixels across: enough for a card held up close.
const READ_MS = 250;
const READ_WIDTH = 640;
// The same card read again within this long is the card still held up, not a second scan: a code stays
// the same for its whole window (30 seconds unless set).
const SAME_CARD_MS = 30_000;

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

/**
 * The door kiosk's camera (decision 0164): the front camera, facing the member, into the video the
 * scanner shows; each frame read for a QR code with jsQR, as Android's WebView cannot be relied on for
 * the browser's own barcode detection. `onCode` hears each card once while it is held up. `cameraError`
 * is true when the camera cannot start (no camera, or permission refused).
 */
export function useCardScanner(onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [cameraError, setCameraError] = useState(false);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isClosed = false;
    let last = { card: '', at: 0 };
    const canvas = document.createElement('canvas');
    const timer = setInterval(() => {
      const code = videoRef.current === null ? null : readFrame(videoRef.current, canvas);
      // A card's code names the card before its first dot; the same card held up is one scan.
      const card = code?.split('.')[0] ?? '';
      if (code === null || (card === last.card && Date.now() - last.at < SAME_CARD_MS)) return;
      last = { card, at: Date.now() };
      onCodeRef.current(code);
    }, READ_MS);
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
      .catch(() => setCameraError(true));
    return () => {
      isClosed = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return { videoRef, cameraError };
}
