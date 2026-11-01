import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { WebImage } from './webMedia.tsx';

describe('WebImage (UI polish audit AS-10)', () => {
  it('offers a still from the website\'s media as AVIF, then WebP, at each width, chosen by its sizes', () => {
    renderIn(<WebImage src="/media/room.webp" alt="The main room" sizes="(min-width: 1180px) 50vw, 100vw" className="size-full" />);
    const image = screen.getByRole('img', { name: 'The main room' });
    const [avif, webp] = Array.from(image.parentElement?.querySelectorAll('source') ?? []);
    expect(image.parentElement?.tagName).toBe('PICTURE');
    expect(avif).toHaveAttribute('type', 'image/avif');
    expect(avif).toHaveAttribute('srcset', '/media/w/room-640.avif 640w, /media/w/room-1280.avif 1280w, /media/w/room-1920.avif 1920w, /media/w/room-2560.avif 2560w');
    expect(webp).toHaveAttribute('type', 'image/webp');
    expect(webp).toHaveAttribute('sizes', '(min-width: 1180px) 50vw, 100vw');
    expect(image).toHaveAttribute('src', '/media/room.webp');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('shows any other address as it is', () => {
    renderIn(<WebImage src="https://cdn.invalid/room.jpg" alt="The room" sizes="100vw" className="size-full" isLazy={false} />);
    const image = screen.getByRole('img', { name: 'The room' });
    expect(image.parentElement?.tagName).not.toBe('PICTURE');
    expect(image).not.toHaveAttribute('loading');
  });
});
