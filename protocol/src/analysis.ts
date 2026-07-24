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
