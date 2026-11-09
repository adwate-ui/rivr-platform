import { useEffect, useRef, useState, type RefObject } from 'react';
import { cardIn, frameIn, greyOf, lookAt, nextCardTrack, START_TRACK, type CardHint, type GreyPicture } from './cardLook.ts';
import { cardJpeg } from './coverBars.ts';

const LOOK_EVERY_MS = 250;
const LOOK_WIDTH = 480;
const LOOK_HEIGHT = 360;
// Enough to read every character of a card, and small to send.
const LONGEST_SIDE = 1800;

/** The frame the person sees, in grey at a small size; null until the camera's picture has arrived. */
function greyFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): GreyPicture | null {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null || video.videoWidth === 0) return null;
  const frame = frameIn(video.videoWidth, video.videoHeight);
  context.drawImage(video, frame.x, frame.y, frame.width, frame.height, 0, 0, LOOK_WIDTH, LOOK_HEIGHT);
  return greyOf(context.getImageData(0, 0, LOOK_WIDTH, LOOK_HEIGHT).data, LOOK_WIDTH, LOOK_HEIGHT);
}

/**
 * The live guidance over the card camera, looking four times a second while the picture is live; `onCapture` runs once, when
 * a card has held good in its outline for most of a second. Everything is worked out on the device: no picture is sent to
 * look at it. A card the device cannot make out never takes itself, and the shutter still works.
 */
export function useCardGuidance(video: RefObject<HTMLVideoElement | null>, isLive: boolean, onCapture: () => void): CardHint {
  const [hint, setHint] = useState<CardHint>('find');
  const capture = useRef(onCapture);
  useEffect(() => {
    capture.current = onCapture;
  }, [onCapture]);
  useEffect(() => {
    if (!isLive) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = LOOK_WIDTH;
    canvas.height = LOOK_HEIGHT;
    let track = START_TRACK;
    let previous: GreyPicture | null = null;
    let hasCaptured = false;
    const timer = setInterval(() => {
      const current = video.current === null ? null : greyFrame(video.current, canvas);
      if (current === null) return;
      track = nextCardTrack(track, lookAt(current, previous), performance.now());
      previous = current;
      setHint(track.hint);
      if (track.hint === 'capturing' && !hasCaptured) {
        hasCaptured = true;
        capture.current();
      }
    }, LOOK_EVERY_MS);
    return () => clearInterval(timer);
  }, [video, isLive]);
  return hint;
}

/** The camera's one video track, once it is showing. */
function trackOf(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject;
  return stream && 'getVideoTracks' in stream ? (stream.getVideoTracks()[0] ?? null) : null;
}

const hasTorch = (track: MediaStreamTrack | null) => track !== null && typeof track.getCapabilities === 'function' && Reflect.get(track.getCapabilities(), 'torch') === true;

/** The phone's torch, where it has one a browser may use: most Android phones do; an iPhone's Safari does not offer it. */
export function useTorch(video: RefObject<HTMLVideoElement | null>, isLive: boolean) {
  const [canToggle, setCanToggle] = useState(false);
  const [isOn, setOn] = useState(false);
  useEffect(() => {
    setCanToggle(isLive && hasTorch(trackOf(video.current)));
    if (!isLive) setOn(false);
  }, [video, isLive]);
  const toggle = () => {
    const next = !isOn;
    void trackOf(video.current)?.applyConstraints({ advanced: [Object.fromEntries([['torch', next]])] }).then(() => setOn(next)).catch(() => undefined);
  };
  return { canToggle, isOn, toggle };
}

/** The card as a JPEG: what its outline showed and nothing round it, at a size that keeps every character readable. */
export async function cardPhotoOf(video: HTMLVideoElement): Promise<Blob> {
  const card = cardIn(frameIn(video.videoWidth, video.videoHeight));
  const scale = Math.min(1, LONGEST_SIDE / card.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(card.width * scale);
  canvas.height = Math.round(card.height * scale);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No canvas to draw the card on');
  context.drawImage(video, card.x, card.y, card.width, card.height, 0, 0, canvas.width, canvas.height);
  return await cardJpeg(canvas);
}
