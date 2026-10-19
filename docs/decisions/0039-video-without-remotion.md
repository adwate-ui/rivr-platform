# 0039 Video is drawn in the render host, not with Remotion

Date: 19 Oct 2026. Task #14.

`docs/engineering/stack.md` named Remotion for MP4. Remotion is free only for organisations of up to three people; RIVR has more staff than that, so it would need a paid company licence. The owner was not asked to buy one for a four-second logo animation.

`@rivr/render` already draws `@rivr/ui` in headless Chromium, and Chromium can encode H.264 itself (WebCodecs). So `renderToMp4` holds the page's CSS animations at each frame's time, captures the frame, and hands it to the render host, which encodes it. Mediabunny (MPL-2.0, the maintained successor to mp4-muxer) writes the MP4 container. Nothing else is added: no ffmpeg, no second renderer.

- The animation is ordinary CSS from `@rivr/ui` and the motion tokens, so the same component can run on the TV or in an app.
- Frames are deterministic: every animation is paused and seeked, never left to run in real time.
- Revisit if RIVR needs long or audio video at volume; Remotion, licensed, would then be worth its cost.
