import type { CageFailure, CageMember } from '@rivr/db';
import { walletAfter, type BuyInMethod } from '@rivr/domain/cage';
import type { Paise } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { ErrorMessage, Inline, Money, Stack, Text } from '@rivr/ui';
import { CAGE_FAILURE_COPY } from './cageCopy.ts';

interface BuyInPreviewProps {
  member: CageMember;
  amount: Paise;
  method: BuyInMethod;
  failure: CageFailure | null;
  /** The amount just issued, as it reads: ₹5,000. */
  issued: string | null;
}

/** What the buy-in leaves, as in the prototype: the wallet after a wallet buy-in, the table's minimum; and why not, or that it is done. */
export function BuyInPreview({ member, amount, method, failure, issued }: BuyInPreviewProps) {
  const left = walletAfter(method, amount, member.wallet);
  return (
    <Stack gap={3}>
      <Stack gap={2} divided>
        {left === null ? null : <Inline justify="between"><Text>{t('console.cage.walletAfter')}</Text><Money paise={left} /></Inline>}
        {member.seat === null ? null : (
          <Inline justify="between"><Text>{t('console.cage.minimumAt', { table: member.seat.tableName })}</Text><Money paise={member.seat.minimum} /></Inline>
        )}
      </Stack>
      {failure === null ? null : <ErrorMessage>{t(CAGE_FAILURE_COPY[failure], { amount: formatMoney(amount) })}</ErrorMessage>}
      {issued === null ? null : <Text>{t('console.cage.issued', { amount: issued })}</Text>}
    </Stack>
  );
}
