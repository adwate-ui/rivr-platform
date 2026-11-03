import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { NoticeText } from './NoticeText.tsx';

// Characters a link could hide behind, by code point so none sits unseen in this file.
const CYRILLIC_I = String.fromCharCode(0x456);
const CYRILLIC_O = String.fromCharCode(0x43e);
const NEXT_LINE = String.fromCharCode(0x85);
const RIGHT_TO_LEFT = String.fromCharCode(0x202e);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

describe('NoticeText', () => {
  it('keeps the paragraphs and line breaks as written', () => {
    const { container } = renderIn(<NoticeText text={'Launch night is Sunday.\nDoors at 7 pm.\n\nDress code: smart casual.'} />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.querySelectorAll('br')).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent('Launch night is Sunday.Doors at 7 pm.');
    expect(paragraphs[1]).toHaveTextContent('Dress code: smart casual.');
  });

  it('makes each https address a link that opens in a new tab, shown without https:// and without the full stop after it', () => {
    renderIn(<NoticeText text="Details at https://rivrpoker.com/launch. Tables at https://app.rivrpoker.com" />);
    const launch = screen.getByRole('link', { name: 'rivrpoker.com/launch' });
    expect(launch).toHaveAttribute('href', 'https://rivrpoker.com/launch');
    expect(launch).toHaveAttribute('target', '_blank');
    expect(launch).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'app.rivrpoker.com' })).toHaveAttribute('href', 'https://app.rivrpoker.com');
    expect(screen.getByText(/Details at/).textContent).toBe('Details at rivrpoker.com/launch. Tables at app.rivrpoker.com');
  });

  it('links nothing but https, and reads nothing as HTML', () => {
    const { container } = renderIn(<NoticeText text={'Old site http://rivr.example and javascript:alert(1)\n<b>bold</b>'} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container).toHaveTextContent('<b>bold</b>');
  });

  it('links only a plain host straight after https://, so a link never reads as one site and goes to another', () => {
    const { container } = renderIn(<NoticeText text={[
      'Slashes https:///rivrpoker.com@evil.example',
      `Lookalike https://r${CYRILLIC_I}vrpoker.com`,
      'Empty https://.',
      `Hidden https://rivrpoker.com${NEXT_LINE}@evil.example`,
      `Turned ${RIGHT_TO_LEFT}https://evil.co/moc.rekoprvir`,
      `Split https://rivrpoker.co${ZERO_WIDTH_SPACE}m/login`,
      `Cut short https://rivrpoker.c${CYRILLIC_O}m`,
    ].join('\n')} />);
    const links = screen.getAllByRole('link');
    // Only the turned one links, to the site it names once read left to right: the rest make no link at all.
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['https://evil.co/moc.rekoprvir']);
    // A link reads left to right whatever marks surround it, so it shows where it goes.
    for (const link of links) expect(link).toHaveAttribute('dir', 'ltr');
    expect(container).toHaveTextContent('https:///rivrpoker.com@evil.example');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<NoticeText text={'Launch night is Sunday.\n\nDetails: https://rivrpoker.com/launch'} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
