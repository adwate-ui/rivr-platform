import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { KycPhoto } from './KycPhoto.tsx';

const SRC = 'https://storage.invalid/kyc/selfie.jpg';

describe('KycPhoto', () => {
  it('shows the photo, named for screen readers', () => {
    renderIn(<KycPhoto alt="KYC photo of Kabir Sethi" src={SRC} />);
    expect(screen.getByRole('img', { name: 'KYC photo of Kabir Sethi' })).toHaveAttribute('src', SRC);
  });

  it('says so while it loads, when there is none, and when it could not be had', () => {
    const { rerender } = renderIn(<KycPhoto alt="KYC photo" src={null} status="loading" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    rerender(<KycPhoto alt="KYC photo" src={null} status="missing" />);
    expect(screen.getByText('No photo')).toBeInTheDocument();
    rerender(<KycPhoto alt="KYC photo" src={null} status="error" />);
    expect(screen.getByText('The photo could not load. Reload the page, or check the member at the desk.')).toBeInTheDocument();
  });

  it('says so when the image itself fails to load, and tries a new address again', () => {
    const { rerender } = renderIn(<KycPhoto alt="KYC photo" src={SRC} />);
    fireEvent.error(screen.getByRole('img', { name: 'KYC photo' }));
    expect(screen.getByText('The photo could not load. Reload the page, or check the member at the desk.')).toBeInTheDocument();
    rerender(<KycPhoto alt="KYC photo" src={`${SRC}?token=new`} />);
    expect(screen.getByRole('img', { name: 'KYC photo' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<KycPhoto alt="KYC photo of Kabir Sethi" src={SRC} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
