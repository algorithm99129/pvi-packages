import type { EntityId } from './index';
import type { InsectArchetype } from './insect';
import type { ServerMapExport } from './map';
import type { ServerMissionExport } from './mission';
import type { PlantRole } from './plant';
import type { UserProfile } from './user';
import type { UserProgression } from './user-xp';
import type { WalletResources } from './wallet';

export type MissionProgressStatus = 'locked' | 'available' | 'completed';

/** Difficulty the player chose when completing a mission. */
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface UserPlantProgress {
  plantId: EntityId;
  level: number;
  unlocked: boolean;
}

export interface UserInsectProgress {
  insectId: EntityId;
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
  /** Stars earned this run (0–3). Server keeps the max with existing progress. */
  stars?: number;
}

export interface UserGameState {
  wallet: WalletResources;
  plants: UserPlantProgress[];
  insects: UserInsectProgress[];
  missions: UserMissionProgress[];
}

/** Authenticated player profile — account info, wallet, and XP / village progression. */
export interface PlayerProfile extends UserProfile, UserProgression {
  wallet: WalletResources;
}

/** Response from POST /api/player/missions/complete */
export interface MissionCompleteResult extends UserProgression {
  progress: UserMissionProgress;
  xpGained: number;
  /** Plant unlocked by this first clear (classic seed-packet reward). */
  unlockPlantId?: EntityId;
  /** Insect unlocked by this first clear, if any. */
  unlockInsectId?: EntityId;
}

/** Plants unlocked when a new account is created (classic: Peashooter only). */
export const STARTER_PLANT_IDS: EntityId[] = [
  'peashooter',
];

/** Insects unlocked when a new account is created (classic: basic beetle only). */
export const STARTER_INSECT_IDS: EntityId[] = [
  'worker_beetle',
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
  /** Gem cost to unlock while locked; `null` if already unlocked or not gem-purchasable. */
  unlockCost: WalletResources | null;
}

export interface UpgradePlantResult {
  plant: UserPlantView;
  wallet: WalletResources;
}

/** Same payload shape as upgrade — spent gems and unlocked roster row. */
export type UnlockPlantResult = UpgradePlantResult;

export interface UserInsectView {
  id: EntityId;
  archetype: InsectArchetype;
  rarity: string;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    moveSpeed: number;
  };
  upgradeCost: WalletResources | null;
  /** Gem cost to unlock while locked; `null` if already unlocked or not gem-purchasable. */
  unlockCost: WalletResources | null;
}

export interface UpgradeInsectResult {
  insect: UserInsectView;
  wallet: WalletResources;
}

export type UnlockInsectResult = UpgradeInsectResult;

/** Full mission definition plus the authenticated player's progress. */
export interface MissionDetailView extends ServerMissionExport {
  progress: UserMissionProgress;
  map: ServerMapExport;
}
