/**
 * Encodes frames to an H.264 MP4 inside the render host, with Chromium's own encoder (WebCodecs).
 * Node captures each frame as a PNG and hands it in; Mediabunny writes the MP4 container.
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';

/** What `renderToMp4` calls in the page: start a video, add one frame at a time, then finish it. */
export interface VideoRecorder {
  start(width: number, height: number, fps: number): Promise<void>;
  /** One frame, a base64 PNG of the video's size. */
  add(png: string): Promise<void>;
  /** The finished MP4, base64. */
  finish(): Promise<string>;
}

declare global {
  interface Window {
    rivrVideo?: VideoRecorder;
  }
}

interface Recording {
  readonly output: Output<Mp4OutputFormat, BufferTarget>;
  readonly source: CanvasSource;
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly fps: number;
  frames: number;
}

async function startRecording(width: number, height: number, fps: number): Promise<Recording> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas in the render host.');
  // A key frame every second, so a player can seek; the file starts with its index, for streaming.
  const source = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_HIGH, keyFrameInterval: 1 });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  return { output, source, context, fps, frames: 0 };
}

/** Base64 of the bytes, in chunks small enough for `String.fromCharCode`. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(text);
}

/** The recorder the host page puts on `window.rivrVideo`. One video at a time. */
export function createVideoRecorder(): VideoRecorder {
  let recording: Recording | null = null;
  const current = (): Recording => {
    if (!recording) throw new Error('No video has been started.');
    return recording;
  };
  return {
    async start(width, height, fps) {
      recording = await startRecording(width, height, fps);
    },
    async add(png) {
      const video = current();
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      video.context.drawImage(image, 0, 0);
      image.close();
      await video.source.add(video.frames / video.fps, 1 / video.fps);
      video.frames += 1;
    },
    async finish() {
      const video = current();
      recording = null;
      await video.output.finalize();
      if (!video.output.target.buffer) throw new Error('The MP4 was not written.');
      return toBase64(video.output.target.buffer);
    },
  };
}
