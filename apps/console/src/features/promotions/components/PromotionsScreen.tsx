import { useStaffVenue } from '@rivr/db';
import { clubDay } from '@rivr/domain/clubDay';
import type { Actor } from '@rivr/domain/promotions';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { useBuilderNames } from '../hooks/useBuilderNames.ts';
import { blankForm } from './builderForm.ts';
import { PromotionBuilder, type BuilderStart } from './PromotionBuilder.tsx';
import { PromotionList } from './PromotionList.tsx';
import { PromotionOpen } from './PromotionOpen.tsx';

/** A new promotion's builder: blank, from today's club day. */
function newStart(): BuilderStart {
  return { promotionId: null, draft: null, form: blankForm(clubDay(new Date())), title: t('console.promotions.builder.newTitle'), notice: null };
}

interface PromotionsScreenProps {
  /** What the address opens (`?open=`): `new` for the builder of a new promotion, a promotion's id, or nothing for the list. */
  open: string | undefined;
  /** Opens one, or the list again with null. */
  onOpen: (open: string | null) => void;
  /** The list's tab in the address (`?tab=ended`; owner, 8 Nov), and how a tab opens. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
}

function PromotionsBody({ venueId, actor, open, onOpen, tab, onNavigate }: PromotionsScreenProps & { venueId: string; actor: Actor }) {
  const names = useBuilderNames(venueId);
  const title = t('console.promotions.title');
  if (names.status !== 'ready') {
    return names.status === 'error' ? <Screen title={title} status="error" onRetry={names.retry} /> : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  const back = () => onOpen(null);
  if (open === undefined) return <PromotionList venueId={venueId} names={names.value.names} onOpen={onOpen} tab={tab} onNavigate={onNavigate} />;
  if (open === 'new') return <PromotionBuilder venueId={venueId} names={names.value} actor={actor} start={newStart()} onDone={back} />;
  return <PromotionOpen key={open} venueId={venueId} promotionId={open} names={names.value} actor={actor} onDone={back} />;
}

/**
 * Promotions (console v3, phase 7; decisions 0471 and 0491 to 0496): the list, the builder of a new promotion or a new
 * version, and the approver's view of a waiting one, each in the address so a refresh, Back or a shared link opens it.
 * For staff who manage promotions; a super admin (promotions.approve) approves another's version.
 */
export function PromotionsScreen(props: PromotionsScreenProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, staffId, permissions } = staff.venue;
  if (!permissions.includes('promotions.manage')) {
    return <Screen title={t('console.promotions.title')} status="error" errorText={t('console.promotions.notAllowed')} />;
  }
  return <PromotionsBody venueId={venueId} actor={{ staffId, permissions }} {...props} />;
}
