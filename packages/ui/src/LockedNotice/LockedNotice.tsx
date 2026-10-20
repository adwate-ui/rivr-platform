import { formatList, t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface LockedNoticeProps {
  /** The tier names that have the feature, in the order admins rank them; none when no tier is the way in. */
  tiers: readonly string[];
}

/**
 * What a locked feature says: the tiers that have it ("Black card only."), or, with no tier to name, that it is not on
 * their account: an override took it from this member alone (#353), or no tier has it.
 */
export function lockedLine(tiers: readonly string[]): string {
  return tiers.length === 0 ? t('common.featureUnavailable') : t('common.featureLocked', { tiers: formatList(tiers) });
}

/** One line saying which tiers have a feature this member lacks ("Black card only."), or that none is the way in. */
export function LockedNotice({ tiers }: LockedNoticeProps) {
  return (
    <div className="flex items-center gap-2 text-content-muted">
      <Icon name="lock" size="sm" />
      <Text as="span" variant="small" tone="muted">
        {lockedLine(tiers)}
      </Text>
    </div>
  );
}
