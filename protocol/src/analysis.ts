/** Default MongoDB URI — same database Nest API uses for player/user documents. */
export const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/garden-siege';

/** Editor analysis: read-only user snapshot (password never included). */
export interface AnalysisUserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarId?: string;
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
  /** Lifetime account XP (user level track). */
  totalXp?: number;
  /** Derived account level from totalXp. */
  userLevel?: number;
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
  | 'reset_wallet';

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
