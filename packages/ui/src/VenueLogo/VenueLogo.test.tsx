import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { VenueLogo } from './VenueLogo.tsx';

describe('VenueLogo', () => {
  it('shows the logo, named for screen readers', async () => {
    const { container } = renderIn(<VenueLogo alt="The venue’s logo" src="https://example.test/logo.svg" />);
    expect(screen.getByRole('img', { name: 'The venue’s logo' })).toHaveAttribute('src', 'https://example.test/logo.svg');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says when there is no logo yet', () => {
    renderIn(<VenueLogo alt="The venue’s logo" src={null} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('No logo yet')).toBeInTheDocument();
  });

  it('says when the logo could not load', () => {
    renderIn(<VenueLogo alt="The venue’s logo" src="https://example.test/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'The venue’s logo' }));
    expect(screen.getByText('The logo could not load. Upload it again.')).toBeInTheDocument();
  });
});
