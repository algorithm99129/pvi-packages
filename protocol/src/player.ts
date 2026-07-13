import type { EntityId } from './index';
import type { ServerMapExport } from './map';
import type { ServerMissionExport } from './mission';
import type { PlantRole } from './plant';
import type { UserProfile } from './user';
import type { WalletResources } from './wallet';

export type MissionProgressStatus = 'locked' | 'available' | 'completed';

/** Difficulty the player chose when completing a mission. */
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface UserPlantProgress {
  plantId: EntityId;
  level: number;
  unlocked: boolean;
}

export interface UserMissionProgress {
  missionId: EntityId;
  status: MissionProgressStatus;
  stars: number;
  /** Difficulty cleared on the most recent successful run. */
  triedLevel?: MissionDifficulty;
  completedAt?: string;
}

/** Request body for POST /api/player/missions/complete */
export interface MissionCompleteRequest {
  missionId: EntityId;
  triedLevel: MissionDifficulty;
}

export interface UserGameState {
  wallet: WalletResources;
  plants: UserPlantProgress[];
  missions: UserMissionProgress[];
}

/** Authenticated player profile — account info plus wallet. */
export interface PlayerProfile extends UserProfile {
  wallet: WalletResources;
}

/** Plants unlocked when a new account is created (chapter 1 seed chooser). */
export const STARTER_PLANT_IDS: EntityId[] = [
  'sun_flower',
  'peashooter',
  'potato_mine',
  'cherry_bomb',
  'spikeweed',
  'squash',
  'repeater_pea',
];

export interface UserPlantView {
  id: EntityId;
  role: PlantRole;
  rarity: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    range: number;
  };
  upgradeCost: WalletResources | null;
}

export interface UpgradePlantResult {
  plant: UserPlantView;
  wallet: WalletResources;
}

/** Full mission definition plus the authenticated player's progress. */
export interface MissionDetailView extends ServerMissionExport {
  progress: UserMissionProgress;
  map: ServerMapExport;
}
