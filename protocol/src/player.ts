import type { EntityId } from './index';
import type { PlantRole } from './plant';
import type { WalletResources } from './wallet';

export type MissionProgressStatus = 'locked' | 'available' | 'completed';

export interface UserPlantProgress {
  plantId: EntityId;
  level: number;
  unlocked: boolean;
}

export interface UserMissionProgress {
  missionId: EntityId;
  status: MissionProgressStatus;
  stars: number;
  completedAt?: string;
}

export interface UserGameState {
  wallet: WalletResources;
  plants: UserPlantProgress[];
  missions: UserMissionProgress[];
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
