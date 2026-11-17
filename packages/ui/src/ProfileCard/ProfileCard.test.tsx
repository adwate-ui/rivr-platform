import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ProfileCard } from './ProfileCard.tsx';

describe('ProfileCard', () => {
  it('names the screen by the member, with their photo and the lines under the name', () => {
    renderIn(<ProfileCard initial="M" photo="https://photos.test/me.jpg" name="Meera Iyer" headingId="me"
      details={['Founders’ Circle · +91 90000 00901', 'Member number 1024']} />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Meera Iyer' });
    expect(heading).toHaveAttribute('id', 'me');
    expect(screen.getByRole('img', { name: 'Your photo' })).toHaveAttribute('src', 'https://photos.test/me.jpg');
    expect(screen.getByText('Founders’ Circle · +91 90000 00901')).toBeInTheDocument();
    expect(screen.getByText('Member number 1024')).toBeInTheDocument();
  });

  it('shows the initial with no photo, and only the lines it is given', () => {
    renderIn(<ProfileCard initial="M" name="Meera Iyer" headingId="me" details={['Member number 1024']} />);
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/Founders/)).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ProfileCard initial="M" name="Meera Iyer" headingId="me" details={['Member number 1024']} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
