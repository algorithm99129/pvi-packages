import type { EntityId } from './index';
import type { WalletResources } from './wallet';

/** Soft cap for clan size (GDD 20–50; MVP uses 30). */
export const TEAM_MAX_MEMBERS = 30;

export const TEAM_MIN_NAME_LEN = 3;
export const TEAM_MAX_NAME_LEN = 24;
export const TEAM_MAX_DESCRIPTION_LEN = 160;

export const TEAM_DEFAULT_REGION = 'global';
/** Matches DEFAULT_FLAG_ID / Flags/flag_000.png. */
export const TEAM_DEFAULT_BANNER_ID = 'flag_000';
export const TEAM_DEFAULT_LEAGUE = 'bronze_1';

/** Max names returned by GET /teams/random-name. */
export const TEAM_RANDOM_NAME_MAX_COUNT = 10;

export type TeamMemberRole = 'leader' | 'officer' | 'member';
export type TeamJoinType = 'open' | 'invite';

export interface TeamMemberView {
  userId: EntityId;
  displayName: string;
  avatarId: string;
  role: TeamMemberRole;
  /** Account trophy / score proxy (userLevel * 1000 for MVP). */
  score: number;
  /** ISO timestamp or empty when unknown. */
  lastActiveAt: string;
  joinedAt: string;
}

/** Pending join application visible to leader/officers. */
export interface TeamJoinRequestView {
  id: EntityId;
  userId: EntityId;
  displayName: string;
  avatarId: string;
  /** Account trophy / score proxy (userLevel * 1000 for MVP). */
  score: number;
  createdAt: string;
}

export interface TeamView {
  id: EntityId;
  name: string;
  description: string;
  level: number;
  score: number;
  league: string;
  joinType: TeamJoinType;
  requiredScore: number;
  region: string;
  bannerId: string;
  avatarId: string;
  memberCount: number;
  maxMembers: number;
  wallet: WalletResources;
  members: TeamMemberView[];
  /** Pending join requests — populated for leader/officer viewers only. */
  joinRequests: TeamJoinRequestView[];
  /** Current user's role in this team, when applicable. */
  myRole: TeamMemberRole | null;
}

/** Lightweight row for browse / join lists. */
export interface TeamSummary {
  id: EntityId;
  name: string;
  description: string;
  level: number;
  score: number;
  league: string;
  joinType: TeamJoinType;
  requiredScore: number;
  region: string;
  bannerId: string;
  memberCount: number;
  maxMembers: number;
}

export interface TeamRankingEntry {
  rank: number;
  id: EntityId;
  name: string;
  score: number;
  bannerId: string;
  league: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  joinType?: TeamJoinType;
  requiredScore?: number;
  /** Team flag id from Flags catalog (e.g. `flag_000`). */
  bannerId?: string;
}

export interface JoinTeamRequest {
  /** Optional; path param is preferred. Kept for body-style clients. */
  teamId?: EntityId;
}

/** Response from POST /teams/:id/join — creates a pending request (no membership yet). */
export interface RequestJoinResult {
  pending: true;
  teamId: EntityId;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  joinType?: TeamJoinType;
  requiredScore?: number;
  bannerId?: string;
}

export interface DonateToTeamRequest {
  coin: number;
}

export interface MyTeamResult {
  team: TeamView | null;
}

export interface TeamMutationResult {
  team: TeamView;
  /** Player wallet after donate (optional on other mutations). */
  wallet?: WalletResources;
}

export interface BrowseTeamsResult {
  teams: TeamSummary[];
}

export interface TeamRankingResult {
  entries: TeamRankingEntry[];
  /** ISO or human-readable season end hint. */
  seasonEndsIn: string;
}

/** Response from GET /teams/random-name — available names for team creation. */
export interface TeamRandomNameResult {
  names: string[];
}
