import { useEffect, useRef, useState, type RefObject } from 'react';

/** What the selfie camera tells the member (decision 0320): come closer, hold still, or it is taking the photo. */
export type Guidance = 'closer' | 'steady' | 'capturing';

/** A face the detector found: where it starts across the frame and how wide it is, in the video's pixels. */
export interface FaceBox {
  readonly x: number;
  readonly width: number;
}

/** Where the guidance stands: since when, and where the face's middle was at the last look. */
export interface GuidanceTrack {
  readonly guidance: Guidance;
  readonly since: number;
  readonly centre: number | null;
}

// A face fills the oval once it is at least this share of the frame's width; it holds still while its middle moves less
// than this share between looks; and the photo is taken once it has held still this long (the brief: about a second).
const FILLS_OVAL = 0.35;
const STILL = 0.06;
const HOLD_MS = 1000;
const LOOK_EVERY_MS = 250;

export const START: GuidanceTrack = { guidance: 'closer', since: 0, centre: null };

/** The guidance after one look: one face filling the oval, held still for a second, is taken; anything else asks again. */
export function nextTrack(track: GuidanceTrack, faces: readonly FaceBox[], frameWidth: number, now: number): GuidanceTrack {
  const [face] = faces;
  if (faces.length !== 1 || face === undefined || face.width < FILLS_OVAL * frameWidth) return { guidance: 'closer', since: now, centre: null };
  const centre = face.x + face.width / 2;
  if (track.centre === null || Math.abs(centre - track.centre) > STILL * frameWidth) return { guidance: 'steady', since: now, centre };
  return { guidance: now - track.since >= HOLD_MS ? 'capturing' : 'steady', since: track.since, centre };
}

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<readonly { boundingBox: DOMRectReadOnly }[]>;
}

/** The browser's own face detector (the Shape Detection API), where it has one; none elsewhere. */
function browserDetector(): Detector | null {
  const constructor: unknown = Reflect.get(globalThis, 'FaceDetector');
  if (typeof constructor !== 'function') return null;
  const detector: unknown = Reflect.construct(constructor, [{ fastMode: true, maxDetectedFaces: 2 }]);
  const detect: unknown = typeof detector === 'object' && detector !== null ? Reflect.get(detector, 'detect') : undefined;
  if (typeof detect !== 'function') return null;
  return { detect: async (source) => Reflect.apply(detect, detector, [source]) };
}

/**
 * The live guidance over the selfie camera, looking four times a second while the picture is live; `onCapture` runs once a
 * single face has filled the oval and held still for a second. Null where the browser has no face detector: the member
 * takes the photo with the shutter.
 */
export function useFaceGuidance(video: RefObject<HTMLVideoElement | null>, isLive: boolean, onCapture: () => void): Guidance | null {
  const [detector] = useState(browserDetector);
  const [track, setTrack] = useState<GuidanceTrack>(START);
  const capture = useRef(onCapture);
  useEffect(() => {
    capture.current = onCapture;
  });
  useEffect(() => {
    if (detector === null || !isLive) return undefined;
    let last = START;
    const look = async () => {
      const element = video.current;
      if (element === null || element.videoWidth === 0 || last.guidance === 'capturing') return;
      const faces = await detector.detect(element).catch(() => []);
      last = nextTrack(last, faces.map(({ boundingBox }) => ({ x: boundingBox.x, width: boundingBox.width })), element.videoWidth, performance.now());
      setTrack(last);
      if (last.guidance === 'capturing') capture.current();
    };
    const timer = setInterval(() => void look(), LOOK_EVERY_MS);
    return () => clearInterval(timer);
  }, [detector, isLive, video]);
  return detector === null ? null : track.guidance;
}
