import type { UserRole } from './user';

/** Default MongoDB URI — same database Nest API uses for player/user documents. */
export const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/garden-siege';

/** Editor analysis: read-only user snapshot (password never included). */
export interface AnalysisUserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarId?: string;
  /** Account privilege — player (default) or admin. */
  role?: UserRole;
  wallet: { coin: number; gem: number; leaf: number };
  plantCount: number;
  unlockedPlantCount: number;
  insectCount: number;
  unlockedInsectCount: number;
  missionCount: number;
  completedMissionCount: number;
  gardenLevel: number;
  gardenMapTemplateId: string;
  gardenPlantCount: number;
  /** True when this account was seeded as an AI raid defender. */
  isAi?: boolean;
  /**
   * False until the sign-up email code is confirmed.
   * Older accounts and bots are treated as verified (true).
   */
  emailVerified?: boolean;
  /** True when an admin has suspended the account (cannot sign in). */
  suspended?: boolean;
  /** Lifetime account XP (user level track). */
  totalXp?: number;
  /** Derived account level from totalXp. */
  userLevel?: number;
  /** Active clan id, or null when not in a team. */
  teamId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisUserDetail extends AnalysisUserSummary {
  plants: Array<{ plantId: string; level: number; unlocked: boolean }>;
  insects: Array<{ insectId: string; level: number; unlocked: boolean }>;
  missions: Array<{
    missionId: string;
    status: 'locked' | 'available' | 'completed';
    stars: number;
    triedLevel?: 'easy' | 'medium' | 'hard';
    completedAt?: string;
  }>;
  garden: {
    level: number;
    mapTemplateId: string;
    layoutVersion: number;
    plants: Array<{ plantId: string; lane: number; column: number }>;
  };
}

export interface AnalysisDbStatus {
  ok: boolean;
  uri: string;
  database?: string;
  userCount?: number;
  teamCount?: number;
  liveEventCount?: number;
  error?: string;
}

/** Editor test-console patches (Mongo writes; not Nest API). */
export interface AnalysisWalletPatch {
  coin: number;
  gem: number;
  leaf: number;
}

export interface AnalysisPlantPatch {
  plantId: string;
  unlocked: boolean;
  level: number;
}

export interface AnalysisInsectPatch {
  insectId: string;
  unlocked: boolean;
  level: number;
}

export interface AnalysisMissionPatch {
  missionId: string;
  status: 'locked' | 'available' | 'completed';
  stars: number;
}

export type AnalysisBulkKind =
  | 'unlock_all_plants'
  | 'unlock_all_insects'
  | 'unlock_all_missions'
  | 'lock_non_starters'
  | 'reset_wallet'
  /** Clear all placed lawn plants (and item-box plant slots); keeps map/level. */
  | 'reset_garden';

/**
 * Parts of an account Studio can put back to what a new account has (Players → Reset account).
 * Each one is independent, so a tester can replay one part of the game without losing the rest.
 */
export const ANALYSIS_RESET_DOMAINS = [
  'level',
  'missions',
  'plants',
  'insects',
  'garden',
  'unlocks',
  'wallet',
  'potions',
  'rewards',
  'record',
] as const;

export type AnalysisResetDomain = (typeof ANALYSIS_RESET_DOMAINS)[number];

export const ANALYSIS_RESET_DOMAIN_INFO: Record<AnalysisResetDomain, { label: string; detail: string }> = {
  level: { label: 'Level & XP', detail: 'Account level 1, 0 XP, daily XP / gem caps cleared.' },
  missions: { label: 'Missions', detail: 'Every mission back to locked with 0 stars; the first one available.' },
  plants: { label: 'Plants', detail: 'Starter plants at level 1; every other plant locked.' },
  insects: { label: 'Insects', detail: 'Starter insects at level 1; every other insect locked.' },
  garden: {
    label: 'Garden',
    detail: 'Level 1 on the starting map, nothing planted, empty item box, no raid history or shield.',
  },
  unlocks: {
    label: 'Village unlocks',
    detail:
      'Forget which hub villages opened. They lock again only where level, missions and usage no longer open them — reset those too for a first-time hub.',
  },
  wallet: { label: 'Wallet', detail: 'Coins, gems and leaves back to the starter amounts.' },
  potions: { label: 'Potions', detail: 'No potions owned, no active buffs, empty battle loadouts.' },
  rewards: {
    label: 'Rewards & quests',
    detail: 'Login streak, daily reward, daily quests, achievements and event claims start over.',
  },
  record: { label: 'Battle record', detail: 'Trophies and attack / defense wins and losses back to 0.' },
};

export interface AnalysisResetRequest {
  domains: AnalysisResetDomain[];
  /** Catalog ids, so rows exist for content added after the account was made. */
  plantIds?: string[];
  insectIds?: string[];
  /** In mission order: the first one becomes available. */
  missionIds?: string[];
}

export interface AnalysisBulkPatch {
  kind: AnalysisBulkKind;
  /** Catalog ids required for unlock-all / lock-non-starters plant ops. */
  plantIds?: string[];
  insectIds?: string[];
  missionIds?: string[];
}

/** Request to insert AI defender accounts for garden raid testing. */
export interface AnalysisCreateAiDefendersRequest {
  /** How many new AI accounts to create (1–20). */
  count: number;
  /** Optional garden map template id (defaults to front_yard). */
  mapTemplateId?: string;
  /** Plant catalog ids used for roster unlocks + layout picks. */
  plantIds?: string[];
  /** Insect catalog ids for roster unlocks. */
  insectIds?: string[];
  /** Mission catalog ids for initial mission progress rows. */
  missionIds?: string[];
}

export interface AnalysisCreateAiDefendersResult {
  created: number;
  skipped: number;
  emails: string[];
  message: string;
}

/** Request to insert AI clan teams + member accounts for team browse/ranking tests. */
export interface AnalysisCreateAiTeamsRequest {
  /** How many new teams to create (1–10). */
  teamCount: number;
  /** Members per team including the leader (2–10). Defaults to 5. */
  membersPerTeam?: number;
  /** Optional garden map template id (defaults to front_yard). */
  mapTemplateId?: string;
  plantIds?: string[];
  insectIds?: string[];
  missionIds?: string[];
}

export interface AnalysisCreateAiTeamsResult {
  teamsCreated: number;
  playersCreated: number;
  skipped: number;
  teamNames: string[];
  emails: string[];
  message: string;
}

/** Editor analysis: clan / team row (Mongo `teams` collection). */
export interface AnalysisTeamSummary {
  id: string;
  name: string;
  description: string;
  level: number;
  score: number;
  league: string;
  joinType: 'open' | 'invite';
  requiredScore: number;
  region: string;
  bannerId: string;
  avatarId: string;
  memberCount: number;
  joinRequestCount: number;
  leaderUserId: string;
  leaderDisplayName?: string;
  wallet: { coin: number; gem: number; leaf: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalysisTeamMemberRow {
  userId: string;
  displayName: string;
  email: string;
  role: 'leader' | 'officer' | 'member';
  isAi?: boolean;
  joinedAt?: string;
}

export interface AnalysisTeamJoinRequestRow {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  createdAt?: string;
}

export interface AnalysisTeamDetail extends AnalysisTeamSummary {
  members: AnalysisTeamMemberRow[];
  joinRequests: AnalysisTeamJoinRequestRow[];
}

/** Partial update for admin team editor (Mongo writes). */
export interface AnalysisTeamPatch {
  name?: string;
  description?: string;
  level?: number;
  score?: number;
  league?: string;
  joinType?: 'open' | 'invite';
  requiredScore?: number;
  region?: string;
  bannerId?: string;
  avatarId?: string;
  wallet?: { coin: number; gem: number; leaf: number };
}
