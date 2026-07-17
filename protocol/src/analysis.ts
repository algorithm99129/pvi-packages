/** Default MongoDB URI — same database Nest API uses for player/user documents. */
export const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/garden-siege';

/** Editor analysis: read-only user snapshot (password never included). */
export interface AnalysisUserSummary {
  id: string;
  email: string;
  displayName: string;
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
