import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor.tsx';

afterEach(cleanup);

describe('a block in the editor', () => {
  it('heads each item of a list, and names its fields without the number (F-040, F-094)', () => {
    render(<BlockEditor position={1} onChange={() => undefined} block={{ kind: 'faq', content: { eyebrow: 'Help', heading: 'Questions', questions: [{ answer: 'Yes', question: 'Open late?' }] } }} />);
    expect(screen.getByRole('heading', { name: 'Question 1' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Line above heading' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Question' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Answer' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Answer 1' })).toBeNull();
  });

  it('names a link\u2019s and a button\u2019s words apart from a card\u2019s own label (F-094)', () => {
    const cards = [{ label: 'One', title: 'First', link: { label: 'See', page: 'visit' } }, { label: 'Two', title: 'Second', link: { label: 'More', page: 'visit' } }];
    render(<BlockEditor position={1} onChange={() => undefined} block={{ kind: 'cards', content: { cards, action: { label: 'Join', to: 'sign-up' } } }} />);
    expect(screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Label' }).map((field) => field.value)).toEqual(['One', 'Two']);
    expect(screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Link label' }).map((field) => field.value)).toEqual(['See', 'More']);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Button label' }).value).toBe('Join');
    expect(screen.queryByRole('textbox', { name: 'Label 2' })).toBeNull();
  });

  it('numbers each figure\u2019s fields, so tabbing through them never hears the same two names (F-094)', () => {
    const figures = [{ value: '6', label: 'Tables' }, { value: '18+', label: 'Members' }];
    render(<BlockEditor position={1} onChange={() => undefined} block={{ kind: 'story', content: { heading: 'Story', paragraphs: ['Words'], figures } }} />);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Figure 2 value' }).value).toBe('18+');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Figure 2 label' }).value).toBe('Members');
    expect(screen.queryByRole('textbox', { name: 'Label' })).toBeNull();
  });
});
