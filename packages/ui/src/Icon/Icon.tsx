import { tokens } from '@rivr/tokens';
import {
  Banknote,
  BookOpen,
  Calendar,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  House,
  IdCard,
  LayoutGrid,
  Lock,
  Menu,
  Star,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * The only icons RIVR draws, by meaning. Icons appear only where they carry meaning a word
 * cannot: the tab bar, the console rail, chevrons, close, the console's menu, lock, alert and offline.
 */
const ICONS = {
  home: House,
  sessions: Calendar,
  balance: Wallet,
  rewards: Star,
  learn: BookOpen,
  profile: UserRound,
  floor: LayoutGrid,
  money: Banknote,
  players: Users,
  growth: TrendingUp,
  team: IdCard,
  reports: ChartColumn,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  close: X,
  lock: Lock,
  menu: Menu,
  alert: TriangleAlert,
  offline: WifiOff,
} satisfies Record<string, LucideIcon>;

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
  const Glyph = ICONS[name];
  const naming = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <Glyph
      size={tokens.icon.size[size]}
      strokeWidth={tokens.icon.stroke}
      nonScalingStroke
      focusable="false"
      className="shrink-0"
      {...naming}
    />
  );
}

/** Every icon name, for stories and tests. */
export const ICON_NAMES = Object.keys(ICONS).filter((name): name is IconName => name in ICONS);
