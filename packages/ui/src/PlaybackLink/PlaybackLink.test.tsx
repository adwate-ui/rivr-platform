import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { PlaybackLink } from './PlaybackLink.tsx';

describe('PlaybackLink', () => {
  it('asks for the link when Playback is pressed, named for its row', async () => {
    const onAsk = vi.fn();
    renderIn(<PlaybackLink state={{ status: 'idle' }} onAsk={onAsk} label="Playback: Table 2, 21:00" />);
    await userEvent.click(screen.getByRole('button', { name: 'Playback: Table 2, 21:00' }));
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it('opens the recording in a new tab once the link is ready', () => {
    renderIn(<PlaybackLink state={{ status: 'ready', url: 'https://cctv.invalid/playback?camera=ch-2', camera: 'Table 2 overhead' }} onAsk={() => undefined} />);
    const link = screen.getByRole('link', { name: 'Open Table 2 overhead at this moment' });
    expect(link).toHaveAttribute('href', 'https://cctv.invalid/playback?camera=ch-2');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says when no camera saw it, with nothing to press', () => {
    renderIn(<PlaybackLink state={{ status: 'failed', reason: 'no_camera' }} onAsk={() => undefined} />);
    expect(screen.getByText('No camera saw this.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers Playback again when the link did not come', async () => {
    const onAsk = vi.fn();
    renderIn(<PlaybackLink state={{ status: 'failed', reason: 'unavailable' }} onAsk={onAsk} />);
    expect(screen.getByText('The recording link did not come.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Playback' }));
    expect(onAsk).toHaveBeenCalledOnce();
  });
});
