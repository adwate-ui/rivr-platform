import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullArchiveForm } from './ArchiveForms.tsx';

afterEach(cleanup);

describe('the full archive form', () => {
  it('makes the archive without KYC photos, or with them only once a reason of ten characters is written', () => {
    const onMake = vi.fn();
    render(<FullArchiveForm isRunning={false} onMake={onMake} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make the archive' }));
    expect(onMake).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('switch', { name: 'Include KYC photos' }));
    const reason = screen.getByRole('textbox', { name: 'Why the photos are needed' });
    fireEvent.change(reason, { target: { value: 'Police' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make the archive' }));
    expect(screen.getByText('Write why the photos are needed, in 10 characters or more.')).toBeTruthy();
    expect(onMake).toHaveBeenCalledTimes(1);

    fireEvent.change(reason, { target: { value: '  Police request, case 41 of 2026 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make the archive' }));
    expect(onMake).toHaveBeenLastCalledWith('Police request, case 41 of 2026');
  });
});
