import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { EditableList } from './EditableList.tsx';

/** The lengths a seated member can ask for: 30, 60 and 120 minutes, each of 5 to 480. */
function choices(initialValues: readonly number[] = [30, 60, 120]) {
  const onChange = vi.fn();
  const drawn = renderIn(
    <EditableList label="Add time choices" entryLabel="Choice" addLabel="Add a choice" unit="minutes" min={5} max={480} initialValues={initialValues} onChange={onChange} />,
  );
  return { onChange, list: screen.getByRole('group', { name: 'Add time choices' }), ...drawn };
}

const field = (number: number) => screen.getByRole('textbox', { name: `Choice ${String(number)}` });
const values = () => screen.getAllByRole('textbox').map((one) => one.getAttribute('value'));

describe('EditableList', () => {
  it('lists each entry as a numbered field with its unit and its own Remove', async () => {
    const { list, container } = choices();
    expect(values()).toEqual(['30', '60', '120']);
    expect(field(2)).toHaveAccessibleDescription('minutes');
    expect(within(list).getByRole('button', { name: 'Remove Choice 2' })).toHaveTextContent('Remove');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('edits an entry and gives every entry in order', async () => {
    const { onChange } = choices();
    await userEvent.clear(field(2));
    await userEvent.type(field(2), '90');
    expect(onChange).toHaveBeenLastCalledWith([30, 90, 120]);
  });

  it('adds an entry, focused and blank, which is refused until it is typed', async () => {
    const { onChange, container } = choices();
    await userEvent.click(screen.getByRole('button', { name: 'Add a choice' }));
    expect(field(4)).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field(4)).toBeInvalid();
    expect(field(4)).toHaveAccessibleDescription('Type a value or remove it.');
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.keyboard('180');
    expect(onChange).toHaveBeenLastCalledWith([30, 60, 120, 180]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses an entry that repeats an earlier one, and one outside the range, each said under its own field', async () => {
    const { onChange } = choices();
    await userEvent.clear(field(3));
    await userEvent.type(field(3), '30');
    expect(onChange).toHaveBeenLastCalledWith(null);
    // The later of the two is the repeat: the first stands.
    expect(field(3)).toHaveAccessibleDescription('Already in the list.');
    expect(field(1)).not.toBeInvalid();
    await userEvent.type(field(3), '00');
    expect(field(3)).toHaveAccessibleDescription('Between 5 and 480 minutes.');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('removes an entry, numbers the rest again and keeps the focus on the list', async () => {
    const { onChange, list } = choices();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Choice 2' }));
    expect(values()).toEqual(['30', '120']);
    expect(field(2)).toHaveValue('120');
    expect(onChange).toHaveBeenLastCalledWith([30, 120]);
    expect(list).toHaveFocus();
  });

  it('removes a refused entry to stand again, and says so when none are left', async () => {
    const { onChange } = choices([30]);
    await userEvent.click(screen.getByRole('button', { name: 'Add a choice' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Choice 2' }));
    expect(onChange).toHaveBeenLastCalledWith([30]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Choice 1' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByText('None yet.')).toBeInTheDocument();
  });

  it('works from the keyboard: Tab from a field reaches its Remove, then the next field', async () => {
    choices([30, 60]);
    field(1).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Remove Choice 1' })).toHaveFocus();
    await userEvent.tab();
    expect(field(2)).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Add a choice' })).toHaveFocus();
  });
});
