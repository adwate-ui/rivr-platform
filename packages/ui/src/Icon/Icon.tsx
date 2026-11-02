import { tokens } from '@rivr/tokens';

/**
 * RIVR's own line icons, drawn for the club (AS-05, 2 Nov 2026): a 24 px grid, the brand's 1.5 px stroke, butt caps and
 * mitred joins, one family. Each icon is its strokes as path data. Icons appear only where they carry meaning a word
 * cannot: the tab bar, chevrons, close, the console's menu, lock, alert and offline, and the website's top bar, where a
 * phone and an envelope say call and write (#616).
 */
const ICONS = {
  // A gabled house with its door: the member's own night at the club (second pass, 2 Nov; the first read as a bank).
  home: ['M3.5 11.5L12 4.5L20.5 11.5', 'M6 9.44V20.5H18V9.44', 'M10.5 20.5V15.5H13.5V20.5'],
  // A calendar page with nights marked: the nights played (second pass, 2 Nov; the first read as a pill).
  sessions: ['M3.5 5.5H20.5V20.5H3.5Z', 'M3.5 10H20.5', 'M8 3.5V7.5', 'M16 3.5V7.5', 'M7 14H8.5', 'M11.25 14H12.75', 'M15.5 14H17',
    'M7 17H8.5', 'M11.25 17H12.75'],
  food: ['M10.5 5.5H13.5', 'M12 5.5V8.5', 'M4.5 16A7.5 7.5 0 0 1 19.5 16', 'M3 16H21', 'M5.5 19H18.5'],
  balance: ['M6.5 4.5H17.5', 'M6.5 8.5H17.5', 'M10 4.5A4.5 4.5 0 0 1 10 13.5H6.5L15 20.5'],
  rewards: ['M6.5 9.5A5.5 5.5 0 1 0 17.5 9.5A5.5 5.5 0 1 0 6.5 9.5Z', 'M9 14.1V20.5L12 18.5L15 20.5V14.1'],
  learn: ['M12 7.5V19.5', 'M12 7.5L3.5 6V18L12 19.5L20.5 18V6Z'],
  profile: ['M8.5 8.5A3.5 3.5 0 1 0 15.5 8.5A3.5 3.5 0 1 0 8.5 8.5Z', 'M5 20.5A7 7 0 0 1 19 20.5'],
  chevronLeft: ['M15 6L9 12L15 18'],
  chevronRight: ['M9 6L15 12L9 18'],
  chevronDown: ['M6 9L12 15L18 9'],
  chevronUp: ['M6 15L12 9L18 15'],
  close: ['M5.5 5.5L18.5 18.5', 'M18.5 5.5L5.5 18.5'],
  /** A step done (StepList); the second pass of 2 Nov drew it the same. */
  check: ['M4.5 12.5L9.5 17.5L19.5 6.5'],
  lock: ['M5.5 10.5H18.5V20.5H5.5Z', 'M8.5 10.5V7.5A3.5 3.5 0 0 1 15.5 7.5V10.5', 'M12 14V17'],
  menu: ['M3.5 6.5H20.5', 'M3.5 12H14.5', 'M3.5 17.5H20.5'],
  alert: ['M12 2.5L21.5 12L12 21.5L2.5 12Z', 'M12 7.5V13.5', 'M12 15V16.5'],
  // The signal broken where the slash crosses it, so the two never tangle at 16 px (second pass, 2 Nov).
  offline: ['M16.26 12.07A9 9 0 0 1 19.79 15.5', 'M4.21 15.5A9 9 0 0 1 9.22 11.44', 'M8.54 18A4 4 0 0 1 15.46 18', 'M4 3L20 19'],
  phone: ['M3.5 3.5H9L10.5 8.5L8 10.5C9.3 13 11 14.7 13.5 16L15.5 13.5L20.5 15V20.5C10.5 20.5 3.5 13.5 3.5 3.5Z'],
  mail: ['M3 5.5H21V18.5H3Z', 'M3 5.5L12 13L21 5.5'],
  /** A Button's turning circle while its action is in flight (F5-17). */
  loading: ['M12 3.5A8.5 8.5 0 1 1 3.5 12'],
  // The player redesign (decision 0320), from its prototype: a banner's mark, the Card tab, the seat's three actions and an
  // offer's arrow.
  info: ['M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12Z', 'M12 8V13', 'M12 15.5V17'],
  card: ['M3 6H21V19H3Z', 'M7 15H12', 'M14 10H18V14H14Z'],
  topUp: ['M4 12A8 8 0 1 0 20 12A8 8 0 1 0 4 12Z', 'M12 8V16', 'M8 12H16'],
  addTime: ['M4 13A8 8 0 1 0 20 13A8 8 0 1 0 4 13Z', 'M12 9V13L15 15', 'M10 2.5H14'],
  leave: ['M14 4H19V20H14', 'M10 8L6 12L10 16', 'M6 12H15'],
  arrowRight: ['M5 12H19', 'M13 6L19 12L13 18'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

export type IconSize = keyof typeof tokens.icon.size;

export interface IconProps {
  name: IconName;
  size?: IconSize;
  /** Names the icon for screen readers. Leave it out when a visible word already says the same. */
  label?: string | undefined;
}

/** A line icon in the current text colour with a 1.5 px stroke at every size. */
export function Icon({ name, size = 'md', label }: IconProps) {
  const pixels = tokens.icon.size[size];
  const naming = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      viewBox="0 0 24 24"
      width={pixels}
      height={pixels}
      fill="none"
      stroke="currentColor"
      strokeWidth={tokens.icon.stroke}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      focusable="false"
      className="shrink-0"
      {...naming}
    >
      {ICONS[name].map((stroke) => <path key={stroke} d={stroke} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/** Every icon name, for stories and tests. */
export const ICON_NAMES = Object.keys(ICONS).filter((name): name is IconName => name in ICONS);
