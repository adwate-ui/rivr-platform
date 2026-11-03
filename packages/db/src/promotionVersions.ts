import {
  eligibilitySchema, limitsSchema, PROMOTION_STATUSES, promotionSimulationSchema, promotionTermsSchema, rewardSchema, scheduleSchema,
  type PromotionSimulationResult, type PromotionStatus, type PromotionTerms,
} from '@rivr/contracts/promotionModel';
import { TERMS_PARTS, termsDiff, type Terms, type TermsPart } from '@rivr/domain/promotions';
import { useQuery } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A promotion on the console's list (console v3 phase 7): its current or open version's words and terms, and this week's grants. */
export interface PromotionOverview {
  readonly id: string;
  readonly templateKey: string | null;
  readonly name: string;
  readonly detail: string | null;
  readonly runs: string | null;
  /** What the list shows: the running or last version's status, else the open one's. */
  readonly status: PromotionStatus;
  readonly currentVersionId: string | null;
  /** A draft or a version waiting for approval, beside a running one or alone. */
  readonly openVersionId: string | null;
  readonly openStatus: PromotionStatus | null;
  readonly rejectedReason: string | null;
  /** Null for a promotion still run by its rule, or terms that cannot be read. */
  readonly terms: Terms | null;
  readonly givenThisWeek: number;
  /** Run by its rule, made before versions (decision 0461): its card and pause only. */
  readonly isLegacy: boolean;
}

/** The list and how many promotions it has in each status, as the filter chips count them. */
export interface PromotionsOverview {
  readonly promotions: readonly PromotionOverview[];
  readonly counts: Readonly<Record<PromotionStatus | 'all', number>>;
}

const statusOf = (text: string | null): PromotionStatus | null => PROMOTION_STATUSES.find((status) => status === text) ?? null;

/** The parts of a version that decide what it gives, or null when any cannot be read. */
export function termsOf(row: { reward: Json; eligibility: Json; schedule: Json; limits: Json }): Terms | null {
  const reward = rewardSchema.safeParse(row.reward);
  const eligibility = eligibilitySchema.safeParse(row.eligibility);
  const schedule = scheduleSchema.safeParse(row.schedule);
  const limits = limitsSchema.safeParse(row.limits);
  if (!reward.success || !eligibility.success || !schedule.success || !limits.success) return null;
  return { reward: reward.data, eligibility: eligibility.data, schedule: schedule.data, limits: limits.data };
}

interface OverviewRow {
  promotion_id: string; template_key: string | null; status: string; name: string; detail: string | null; runs: string | null;
  current_version_id: string | null; current_status: string | null; open_version_id: string | null; open_status: string | null;
  rejected_reason: string | null; reward: Json; eligibility: Json; schedule: Json; limits: Json; given_this_week: number; is_legacy: boolean;
}

/** A row of promotions_overview as the list shows it; a rule's promotion waiting reads as awaiting approval. */
export function toPromotionOverview(row: OverviewRow): PromotionOverview {
  const listed = statusOf(row.current_status) ?? statusOf(row.open_status) ?? (row.status === 'pending' ? 'awaiting_approval' : statusOf(row.status));
  return {
    id: row.promotion_id, templateKey: row.template_key, name: row.name, detail: row.detail, runs: row.runs, status: listed ?? 'draft',
    currentVersionId: row.current_version_id, openVersionId: row.open_version_id, openStatus: statusOf(row.open_status),
    rejectedReason: row.rejected_reason, terms: row.is_legacy ? null : termsOf(row), givenThisWeek: Number(row.given_this_week), isLegacy: row.is_legacy,
  };
}

/**
 * Whether a status's filter chip lists the promotion: its own status, and awaiting approval too while a new version of a
 * running one waits (console v3: the approver finds it there).
 */
export function isListedIn(promotion: PromotionOverview, status: PromotionStatus): boolean {
  return promotion.status === status || (status === 'awaiting_approval' && promotion.openStatus === 'awaiting_approval');
}

/** How many promotions each status's filter chip lists, and in all. */
export function countByStatus(promotions: readonly PromotionOverview[]): PromotionsOverview['counts'] {
  const counts = Object.fromEntries(PROMOTION_STATUSES.map((status) => [status, promotions.filter((one) => isListedIn(one, status)).length]));
  return { draft: 0, awaiting_approval: 0, scheduled: 0, live: 0, paused: 0, ended: 0, ...counts, all: promotions.length };
}

/** The venue's promotions, newest first, with counts by status and the grants each gave this club week, for staff who manage promotions. */
export function usePromotionsOverview(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionsOverview(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionsOverview> => {
      const { data, error } = await client.rpc('promotions_overview', { p_venue_id: venueId });
      if (error) throw error;
      const promotions = data.map(toPromotionOverview);
      return { promotions, counts: countByStatus(promotions) };
    },
  });
}

/** One version as the builder and the approver read it. */
export interface PromotionVersionView {
  readonly id: string;
  readonly version: number;
  readonly status: PromotionStatus;
  /** Null when its terms cannot be read: it can only be rejected. */
  readonly terms: PromotionTerms | null;
  readonly detail: string | null;
  readonly runs: string | null;
  readonly author: string | null;
  /** Whether the signed-in staff member submitted or last changed it: they never approve it. */
  readonly isMine: boolean;
  readonly submittedAt: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly rejectedReason: string | null;
  readonly simulation: PromotionSimulationResult | null;
}

interface VersionRow {
  id: string; version: number; status: string; name: string; reward: Json; eligibility: Json; schedule: Json; limits: Json; channels: Json;
  rules_text: string[]; link: string | null; detail: string | null; runs: string | null; author: string | null; is_mine: boolean;
  submitted_at: string | null; decided_by: string | null; decided_at: string | null; rejected_reason: string | null; simulation: Json;
}

/** A row of promotion_versions_of. */
export function toPromotionVersion(row: VersionRow): PromotionVersionView {
  const terms = promotionTermsSchema.safeParse({
    name: row.name, reward: row.reward, eligibility: row.eligibility, schedule: row.schedule, limits: row.limits, channels: row.channels,
    rulesText: row.rules_text, ...(row.link === null ? {} : { link: row.link }),
  });
  const simulation = promotionSimulationSchema.safeParse(row.simulation);
  return {
    id: row.id, version: row.version, status: statusOf(row.status) ?? 'draft', terms: terms.success ? terms.data : null, detail: row.detail,
    runs: row.runs, author: row.author, isMine: row.is_mine, submittedAt: row.submitted_at, decidedBy: row.decided_by, decidedAt: row.decided_at,
    rejectedReason: row.rejected_reason, simulation: simulation.success ? simulation.data : null,
  };
}

/** One promotion's versions, newest first. */
export function usePromotionVersions(promotionId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionVersions(userId ?? 'signed-out', promotionId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionVersionView[]> => {
      const { data, error } = await client.rpc('promotion_versions_of', { p_promotion_id: promotionId });
      if (error) throw error;
      return data.map(toPromotionVersion);
    },
  });
}

/** What the approver reads: the running version, the one waiting, and the parts it changes (every part when nothing runs yet). */
export interface ApproverView {
  readonly live: PromotionVersionView | null;
  readonly waiting: PromotionVersionView | null;
  readonly changed: readonly TermsPart[];
}

const RUNNING: readonly PromotionStatus[] = ['scheduled', 'live', 'paused'];

/** The approver's diff of a waiting version against the live one. */
export function approverViewOf(versions: readonly PromotionVersionView[]): ApproverView {
  const live = versions.find((one) => RUNNING.includes(one.status)) ?? null;
  const waiting = versions.find((one) => one.status === 'awaiting_approval') ?? null;
  const changed = live?.terms && waiting?.terms ? termsDiff(live.terms, waiting.terms) : [...TERMS_PARTS];
  return { live, waiting, changed: waiting === null ? [] : changed };
}

/** What a promotion gave a member, for the member's record (Visits). */
export interface MemberPromotionGrant {
  readonly id: string;
  readonly grantedAt: string;
  readonly clubDay: string;
  readonly promotion: string;
  readonly version: number | null;
  readonly points: number;
  readonly chips: number;
  readonly spins: number;
  readonly perk: string | null;
}

/** The promotions a member was given, newest first, for staff who read members. */
export function useMemberPromotionGrants(memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberPromotionGrants(userId ?? 'signed-out', memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<MemberPromotionGrant[]> => {
      const { data, error } = await client.rpc('member_promotion_grants', { p_member_id: memberId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.grant_id, grantedAt: row.granted_at, clubDay: row.club_day, promotion: row.promotion_name, version: row.version,
        points: Number(row.points), chips: Number(row.chips), spins: row.spins, perk: row.perk,
      }));
    },
  });
}
