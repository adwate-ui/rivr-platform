import type { ListFilter, MemberChoiceColumn, MemberChoices } from '@rivr/db';
import { t } from '@rivr/i18n';
import type { ColumnChoice } from '@rivr/ui';

type Worded = Exclude<MemberChoiceColumn, 'city'>;

/** The server's codes for the values of Status, ID check and Tonight, each with the words the list shows. A city is its own words. */
function wordsFor(): Readonly<Record<Worded, Readonly<Record<string, string>>>> {
  return {
    status: {
      active: t('console.members.accountStatus.active'), on_break: t('console.members.accountStatus.on_break'),
      frozen: t('console.members.accountStatus.frozen'), erased: t('console.members.accountStatus.erased'),
    },
    kyc: {
      verified: t('console.members.kycStatuses.verified'), in_review: t('console.members.kycStatuses.in_review'), at_desk: t('console.members.kycStatuses.at_desk'),
      refused: t('console.members.kycStatuses.refused'), not_done: t('console.members.kycStatuses.not_done'),
    },
    tonight: {
      seated: t('console.members.tonightKinds.seated'), waiting: t('console.members.waiting'), in_room: t('console.members.inRoom'),
      left: t('console.members.left'), not_here: t('console.members.tonightKinds.notHere'),
    },
  };
}

const isWorded = (column: string): column is Worded => column === 'status' || column === 'kyc' || column === 'tonight';

/**
 * What a column's menu offers (redesign correction 4): its values in the list's words, each with the server's count over
 * every member the other filters leave; none until the counts are read.
 */
export function choicesIn(column: MemberChoiceColumn, counted: MemberChoices | undefined): readonly ColumnChoice[] {
  const words = isWorded(column) ? wordsFor()[column] : undefined;
  return (counted?.[column] ?? []).map(({ value, count }) => ({ value: words?.[value] ?? value, count }));
}

/** A view's filters as the server reads them: a value chosen in the list's words goes as the server's code. */
export function filtersInCodes(filters: Readonly<Record<string, ListFilter>>): Readonly<Record<string, ListFilter>> {
  const words = wordsFor();
  return Object.fromEntries(Object.entries(filters).map(([column, filter]): [string, ListFilter] => {
    if (!isWorded(column) || filter.kind !== 'choice') return [column, filter];
    const codes = Object.entries(words[column]);
    return [column, { kind: 'choice', chosen: filter.chosen.map((label) => codes.find(([, word]) => word === label)?.[0] ?? label) }];
  }));
}
