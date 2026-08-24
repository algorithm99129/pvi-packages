import type { EntityId } from './index';
import type { HubRewardGrant } from './reward-plan';
import type { GoldCupConfig, SeasonMode } from './strength';
import { defaultGoldCupConfig } from './strength';

/** Timed live-ops content stored in MongoDB (`live_events` collection). */
export type LiveEventKind = 'event' | 'season' | 'news';

/** Who can see and claim the entry. */
export type LiveEventAudience = 'individual' | 'team' | 'all';

export type LiveEventRewardStatus = 'none' | 'locked' | 'claimable' | 'claimed';

export type { SeasonMode, GoldCupConfig };
export { defaultGoldCupConfig };

/** Authorable / stored event document (editor + Mongo). */
export interface LiveEventRecord {
  id: EntityId;
  kind: LiveEventKind;
  audience: LiveEventAudience;
  name: string;
  description: string;
  /** ISO-8601; defaults to createdAt when omitted on create. */
  startsAt: string;
  /** ISO-8601; required for timed events/seasons. */
  endsAt: string;
  published: boolean;
  pinned: boolean;
  image?: string;
  reward?: HubRewardGrant;
  /** When audience is team, grant coin/gem/leaf to team treasury instead of the player wallet. */
  teamRewardToTreasury?: boolean;
  /** `gold_cup` enables daily team match tables + membership freeze. */
  seasonMode?: SeasonMode;
  goldCup?: GoldCupConfig;
  /** Competition day index (0-based); advanced by daily tick. */
  seasonDayIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Editor analysis list row. */
export interface AnalysisLiveEventSummary {
  id: string;
  kind: LiveEventKind;
  audience: LiveEventAudience;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  pinned: boolean;
  isActive: boolean;
  image?: string;
  hasReward: boolean;
  teamRewardToTreasury?: boolean;
  seasonMode?: SeasonMode;
  seasonDayIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisLiveEventDetail extends AnalysisLiveEventSummary {
  reward?: HubRewardGrant;
  goldCup?: GoldCupConfig;
}

/** Editor Mongo writes. */
export interface AnalysisLiveEventPatch {
  kind?: LiveEventKind;
  audience?: LiveEventAudience;
  name?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  published?: boolean;
  pinned?: boolean;
  image?: string;
  reward?: HubRewardGrant | null;
  teamRewardToTreasury?: boolean;
  seasonMode?: SeasonMode;
  goldCup?: GoldCupConfig | null;
}

/** Create payload for editor (Mongo insert). */
export interface AnalysisLiveEventCreate {
  kind?: LiveEventKind;
  audience?: LiveEventAudience;
  name: string;
  description?: string;
  startsAt?: string;
  /** Duration in hours when endsAt omitted. */
  durationHours?: number;
  endsAt?: string;
  published?: boolean;
  pinned?: boolean;
  image?: string;
  reward?: HubRewardGrant | null;
  teamRewardToTreasury?: boolean;
  seasonMode?: SeasonMode;
  goldCup?: GoldCupConfig | null;
}

/** GET /live-events/hub — hub banner + badge. */
export interface LiveEventHubState {
  unreadCount: number;
  /** Primary active timed event/season for the hub countdown banner. */
  activeBanner: LiveEventBannerView | null;
  /** True when an active Gold Cup season freezes team membership. */
  teamMembershipLocked?: boolean;
}

export interface LiveEventBannerView {
  id: EntityId;
  kind: LiveEventKind;
  name: string;
  endsAt: string;
  secondsRemaining: number;
  seasonMode?: SeasonMode;
}

/** GET /live-events/feed item. */
export interface LiveEventFeedItemView {
  id: EntityId;
  kind: LiveEventKind;
  audience: LiveEventAudience;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isRead: boolean;
  pinned: boolean;
  image?: string;
  reward?: HubRewardGrant;
  rewardStatus: LiveEventRewardStatus;
  teamRewardToTreasury?: boolean;
  seasonMode?: SeasonMode;
}

export interface LiveEventFeedResult {
  items: LiveEventFeedItemView[];
  unreadCount: number;
}

export interface LiveEventClaimResult {
  feed: LiveEventFeedResult;
  wallet: { coin: number; gem: number; leaf: number };
  unlockPlantId?: EntityId;
  unlockInsectId?: EntityId;
}

export interface LiveEventReadResult {
  unreadCount: number;
}

export interface SeasonTeamLockState {
  locked: boolean;
  seasonId?: EntityId;
  seasonName?: string;
  endsAt?: string;
}
