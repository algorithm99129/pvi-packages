import type { EntityId } from './index';

/**
 * Upgrade cards granted per insect type used, multiplied by stars (1–3).
 * Tunable constant until a logic.json formula is authored.
 */
export const RAID_INSECT_CARDS_PER_STAR = 2;

/** Default scout preview length before combat auto-starts. */
export const GARDEN_RAID_SCOUT_TIMEOUT_SEC = 10;

/** Attacker starting sun for village (garden) raids. */
export const GARDEN_RAID_STARTING_SUN = 2000;

/** Default battle countdown after scout ends. */
export const GARDEN_RAID_BATTLE_DURATION_SEC = 90;

/** Request body for POST /api/raids/garden/complete */
export interface GardenRaidCompleteRequest {
  /** Insect types deployed (or loadout) during the village attack. */
  insectIds: EntityId[];
  /** Stars earned this raid (0–3). */
  stars: number;
  victory: boolean;
  /** Optional defender account id (must not be the attacker). */
  defenderUserId?: string;
}

export interface InsectUpgradeCardClaim {
  insectId: EntityId;
  count: number;
}

/** Response from POST /api/raids/garden/complete */
export interface GardenRaidCompleteResult {
  upgradeCards: InsectUpgradeCardClaim[];
}

/** Request body for POST /api/raids/garden/match */
export interface GardenRaidMatchRequest {
  /** Opponent user ids to skip this session (Find Next). */
  excludeUserIds?: string[];
}

/** One lawn plant in a scout / raid snapshot. */
export interface GardenRaidPlacedPlant {
  plantId: EntityId;
  lane: number;
  column: number;
  level: number;
}

/** Village item-box charge for scout / garden defense. */
export interface GardenRaidItemBoxSlot {
  plantId?: EntityId;
  readyAt?: string;
}

export interface GardenRaidItemBox {
  unlockedCount: number;
  slots: GardenRaidItemBoxSlot[];
}

/**
 * Scout snapshot returned by POST /api/raids/garden/match.
 * Client maps this into an attacker-side RaidDummy payload.
 */
export interface GardenRaidScoutSnapshot {
  defenderUserId: string;
  displayName: string;
  avatarId: string;
  isAi: boolean;
  trophyScore: number;
  mapTemplateId: EntityId;
  gardenLevel: number;
  placedPlants: GardenRaidPlacedPlant[];
  itemBox?: GardenRaidItemBox;
  scoutTimeoutSec: number;
  startingSun: number;
  battleDurationSec: number;
}
