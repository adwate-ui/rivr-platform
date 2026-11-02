import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CallTimeChoice } from './CallTimeChoice.tsx';

describe('CallTimeChoice', () => {
  it('offers the club’s usual times and Custom, with the first chosen', () => {
    renderIn(<CallTimeChoice choices={[180, 240, 300]} initial={180} onChange={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Call time' })).toBeDefined();
    expect(['3 h', '4 h', '5 h', 'Custom'].map((name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')))
      .toEqual(['true', 'false', 'false', 'false']);
    expect(screen.queryByRole('textbox', { name: /^Minutes/ })).toBeNull();
  });

  it('says the minutes chosen, and for Custom the whole minutes typed or none', () => {
    const onChange = vi.fn();
    renderIn(<CallTimeChoice choices={[180, 240, 300]} initial={180} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '5 h' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Minutes/ }), { target: { value: '150' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Minutes/ }), { target: { value: 'two' } });
    expect(onChange.mock.calls).toEqual([[300], [null], [150], [null]]);
  });

  it('opens on Custom, filled in, for a call time none of the usual', () => {
    renderIn(<CallTimeChoice choices={[180, 240, 300]} initial={150} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Custom' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('textbox', { name: /^Minutes/ })).toHaveValue('150');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CallTimeChoice choices={[180, 240, 300]} initial={150} onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
