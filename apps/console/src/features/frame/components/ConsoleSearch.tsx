import type { Permission } from '@rivr/contracts';
import { useMemberSearch, type MemberRow } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { CommandPalette, SearchTrigger, type PaletteGroup, type PaletteItem, type SideNavSection } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { isAllowedAt } from './rail.ts';

interface Action {
  readonly id: string;
  readonly label: MessageKey;
  readonly href: string;
  readonly anyOf: readonly Permission[];
}

// The night's commonest jobs, each opening the screen where it is done.
const ACTIONS: readonly Action[] = [
  { id: 'seat', label: 'console.shell.palette.seat', href: '/', anyOf: ['waitlist.manage'] },
  { id: 'waitlist', label: 'console.shell.palette.addToWaitlist', href: '/waitlist', anyOf: ['waitlist.manage'] },
  { id: 'checkIn', label: 'console.shell.palette.checkIn', href: '/door?tab=check-in', anyOf: ['waitlist.manage'] },
];

const matches = (label: string, query: string) => label.toLowerCase().includes(query.trim().toLowerCase());

interface GroupsInput {
  query: string;
  members: readonly MemberRow[];
  permissions: readonly Permission[];
  sections: readonly SideNavSection[];
  go: (href: string) => void;
}

/** What the palette finds for what is typed: members by name or number, the night's actions, and the screens on the rail. */
function groupsFor({ query, members, permissions, sections, go }: GroupsInput): PaletteGroup[] {
  const found: PaletteItem[] = members.slice(0, 5).map((member) => ({
    id: member.memberId, label: member.fullName, meta: t('console.shell.palette.memberNumber', { number: member.memberNumber }),
    onSelect: () => go(`/members?member=${member.memberId}`),
  }));
  const actions: PaletteItem[] = ACTIONS.filter((action) => action.anyOf.some((permission) => permissions.includes(permission)))
    .map((action) => ({ id: action.id, label: t(action.label), meta: t('console.shell.palette.action'), onSelect: () => go(action.href) }))
    .filter((action) => matches(action.label, query));
  const screens: PaletteItem[] = sections.flatMap((section) => section.items).filter((item) => matches(item.label, query))
    .slice(0, query.trim() === '' ? 5 : 6)
    .map((item) => ({ id: item.id, label: item.label, meta: t('console.shell.palette.screen'), onSelect: () => go(item.href) }));
  return [
    { id: 'members', label: t('console.shell.palette.members'), items: found },
    { id: 'actions', label: t('console.shell.palette.actions'), items: actions },
    { id: 'screens', label: t('console.shell.palette.screens'), items: screens },
  ];
}

interface ConsoleSearchProps {
  venueId: string;
  permissions: readonly Permission[];
  sections: readonly SideNavSection[];
}

/**
 * The header's search (console v3): the trigger, and the palette it opens, also opened by `/` or Ctrl K. It finds members
 * for staff who open Members, the night's actions their role does, and the screens on their rail.
 */
export function ConsoleSearch({ venueId, permissions, sections }: ConsoleSearchProps) {
  const navigate = useNavigate();
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const canFindMembers = permissions.includes('members.read') && isAllowedAt(permissions, '/members');
  const members = useMemberSearch(venueId, canFindMembers ? query : '');
  const groups = groupsFor({ query, members: members.data ?? [], permissions, sections, go: (href) => void navigate({ href }) });
  const open = (next: boolean) => {
    if (next) setQuery('');
    setOpen(next);
  };
  return (
    <>
      {/* It says what the role can find: no members for those who do not open Members (audit F-037). */}
      <SearchTrigger onOpen={() => open(true)} label={canFindMembers ? undefined : t('console.shell.palette.triggerNoMembers')} />
      <CommandPalette isOpen={isOpen} onOpenChange={open} query={query} onQueryChange={setQuery} groups={groups}
        placeholder={canFindMembers ? undefined : t('console.shell.palette.placeholderNoMembers')} />
    </>
  );
}
