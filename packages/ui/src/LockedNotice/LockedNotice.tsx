import { formatList, useT } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface LockedNoticeProps {
  /** The tier names that have the feature, in the order admins rank them. */
  tiers: readonly string[];
}

/** One line saying which tiers have a feature this member's tier lacks: "Black card only." */
export function LockedNotice({ tiers }: LockedNoticeProps) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 text-content-muted">
      <Icon name="lock" size="sm" />
      <Text as="span" variant="small" tone="muted">
        {t('common.featureLocked', { tiers: formatList(tiers) })}
      </Text>
    </div>
  );
}
