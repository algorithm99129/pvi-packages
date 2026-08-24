import type { EntityId } from './index';
import type { GardenProductionPickup } from './garden';

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

/**
 * How long a defender stays "under attack" after matchmake (scout + battle + buffer).
 * Hub uses this to show the sword overlay / lock the garden.
 */
export const GARDEN_UNDER_ATTACK_TTL_SEC =
  GARDEN_RAID_SCOUT_TIMEOUT_SEC + GARDEN_RAID_BATTLE_DURATION_SEC + 30;

/** Safe-mode / shield duration after a garden raid ends (24h). */
export const GARDEN_SAFE_MODE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Window for garden defense history shown in the client (24h). */
export const GARDEN_RAID_HISTORY_WINDOW_MS = GARDEN_SAFE_MODE_DURATION_MS;

/** True when `until` is a future ISO timestamp. */
export function isFutureIsoTimestamp(
  until: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!until || typeof until !== 'string') return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > nowMs;
}

/** One plant-type upgrade-card stack stolen during a village raid. */
export interface GardenRaidStolenCard {
  plantId: EntityId;
  amount: number;
}

/** Loot taken from one defender plant during a village raid. */
export interface GardenRaidStolenPlantLoot {
  lane: number;
  column: number;
  coin: number;
  gem: number;
  cards: GardenRaidStolenCard[];
}

/** Aggregated stolen resources from a village raid. */
export interface GardenRaidStolenSummary {
  coin: number;
  gem: number;
  cards: GardenRaidStolenCard[];
}

/** Request body for POST /api/raids/garden/complete */
export interface GardenRaidCompleteRequest {
  /** Insect types deployed (or loadout) during the village attack. */
  insectIds: EntityId[];
  /** Stars earned this raid (0–3). */
  stars: number;
  victory: boolean;
  /** Optional defender account id (must not be the attacker). */
  defenderUserId?: string;
  /** Client-reported loot stolen from defender plants (capped server-side). */
  stolenLoot?: GardenRaidStolenPlantLoot[];
  /** Battle recording for defender history / replay (garden raids). */
  replay?: GardenRaidReplay;
  /** When set, apply team-match war scoring (formation attempts / stars). */
  teamMatchId?: EntityId;
  /** Lanes fully cleared this raid — used for war star table when teamMatchId is set. */
  lanesDestroyed?: number;
}

export interface InsectUpgradeCardClaim {
  insectId: EntityId;
  count: number;
}

/** Response from POST /api/raids/garden/complete */
export interface GardenRaidCompleteResult {
  upgradeCards: InsectUpgradeCardClaim[];
  /** Wallet/card loot stolen from the defender garden (if any). */
  stolen?: GardenRaidStolenSummary;
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
  /** Continuous pending coin available to steal / show. */
  pendingCoin?: number;
  /** Continuous pending gem available to steal / show. */
  pendingGem?: number;
  /** Pending upgrade-card pickups on this plant. */
  productionQueue?: GardenProductionPickup[];
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

/** One timed action in a garden raid replay. */
export interface GardenRaidReplayAction {
  /** Seconds from battle start. */
  t: number;
  type: 'deploy_insect';
  insectId: EntityId;
  lane: number;
  level: number;
}

/** Stored battle recording for garden raid history / replay. */
export interface GardenRaidReplay {
  scoutSnapshot: GardenRaidScoutSnapshot;
  insectIds: EntityId[];
  actions: GardenRaidReplayAction[];
  durationSec: number;
  victory: boolean;
  stars: number;
}

/** One raid against the player's garden (defender log). */
export interface GardenRaidHistoryEntry {
  id: string;
  attackerUserId: string;
  attackerDisplayName: string;
  attackerAvatarId: string;
  attackerIsAi: boolean;
  /** True when the attacker won the raid. */
  victory: boolean;
  stars: number;
  stolenCoin: number;
  stolenGem: number;
  attackedAt: string;
  /** Present when a full battle was recorded (player or simulated AI raid). */
  replay?: GardenRaidReplay;
  /** True while a simulated AI raid is running server-side (test helper). */
  inProgress?: boolean;
  /** ISO time when under-attack ends (Hub sword / garden lock). */
  underAttackUntil?: string;
}

export interface GardenRaidHistoryResponse {
  entries: GardenRaidHistoryEntry[];
}

/** POST /api/raids/garden/test/ai-attack — run a full AI garden raid (testing). */
export interface SimulateAiGardenAttackRequest {
  /** Target garden owner; defaults to the authenticated user. */
  defenderUserId?: string;
  /** Optional override — otherwise outcome is simulated from garden strength. */
  stars?: number;
  victory?: boolean;
}
