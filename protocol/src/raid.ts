import type { EntityId } from './index';
import type { GardenProductionPickup } from './garden';

/**
 * Leaves granted per insect type used, multiplied by stars (1–5).
 * Same numeric rate as the retired upgrade-card grant.
 */
export const RAID_INSECT_LEAVES_PER_STAR = 2;

/** @deprecated Use {@link RAID_INSECT_LEAVES_PER_STAR}. */
export const RAID_INSECT_CARDS_PER_STAR = RAID_INSECT_LEAVES_PER_STAR;

/** Max stars for garden / live lane-clear scoring. */
export const GARDEN_RAID_MAX_STARS = 5;

/**
 * Leaf spend refund multipliers by star (index = stars).
 * Index 0 unused; ≥2★ aims for positive EV vs leavesSpent.
 */
export const GARDEN_RAID_LEAF_REFUND_BY_STAR: readonly number[] = [
  0, 0.5, 1.1, 1.35, 1.6, 2.0,
];

/**
 * Fraction of eligible defender pending production stealable by star.
 * `share = STEAL_BASE + STEAL_PER_STAR * stars` (still capped by available).
 */
export const GARDEN_RAID_STEAL_BASE = 0.2;
export const GARDEN_RAID_STEAL_PER_STAR = 0.15;

/** Item-box bomb recharge: next = base * 2^uses + elapsedSec * RAMP (capped). */
export const GARDEN_ITEM_BOX_RECHARGE_RAMP = 0.5;
export const GARDEN_ITEM_BOX_RECHARGE_CAP_SEC = 180;

/** Default scout preview length before combat auto-starts. */
export const GARDEN_RAID_SCOUT_TIMEOUT_SEC = 10;

/** Default battle countdown after scout ends (3 minutes). */
export const GARDEN_RAID_BATTLE_DURATION_SEC = 180;

/**
 * How long a defender stays "under attack" after matchmake (scout + battle + buffer).
 * Hub uses this to show the sword overlay / lock the garden.
 */
export const GARDEN_UNDER_ATTACK_TTL_SEC =
  GARDEN_RAID_SCOUT_TIMEOUT_SEC + GARDEN_RAID_BATTLE_DURATION_SEC + 30;

/**
 * Editor Constants id — hours of post-raid garden safe mode (shield).
 * Tunable in `Systems/logic.json` / Constants page; API reads via FormulaService.
 */
export const GARDEN_SAFE_MODE_HOURS_ID = 'GARDEN_SAFE_MODE_HOURS';

/** Default safe-mode duration when the constant is missing (1 hour). */
export const GARDEN_SAFE_MODE_HOURS_DEFAULT = 1;

/** Fallback safe-mode duration in ms (matches {@link GARDEN_SAFE_MODE_HOURS_DEFAULT}). */
export const GARDEN_SAFE_MODE_DURATION_MS =
  GARDEN_SAFE_MODE_HOURS_DEFAULT * 60 * 60 * 1000;

/** Window for garden defense history shown in the client (always 24h). */
export const GARDEN_RAID_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True when `until` is a future ISO timestamp. */
export function isFutureIsoTimestamp(
  until: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!until || typeof until !== 'string') return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > nowMs;
}

/** Loot taken from one defender plant during a village raid. */
export interface GardenRaidStolenPlantLoot {
  lane: number;
  column: number;
  coin: number;
  gem: number;
  /** Leaves stolen from this plant's pending garden production queue. */
  leaf: number;
}

/** Aggregated stolen resources from a village raid. */
export interface GardenRaidStolenSummary {
  coin: number;
  gem: number;
  leaf: number;
}

/** Request body for POST /api/raids/garden/complete */
export interface GardenRaidCompleteRequest {
  /** Insect types deployed (or loadout) during the village attack. */
  insectIds: EntityId[];
  /** Stars earned this raid (0–5). */
  stars: number;
  /** Lanes where the lawn mower fired (secured, not fully destroyed). */
  lanesSecured?: number;
  victory: boolean;
  /** Optional defender account id (must not be the attacker). */
  defenderUserId?: string;
  /** Client-reported loot stolen from defender plants (capped server-side). */
  stolenLoot?: GardenRaidStolenPlantLoot[];
  /**
   * Leaves spent deploying insects this raid (debited from wallet.leaf).
   * Capped server-side to wallet + stolen leaf on victory, or wallet alone on defeat.
   */
  leavesSpent?: number;
  /** Battle recording for defender history / replay (garden raids). */
  replay?: GardenRaidReplay;
  /** When set, apply team-match war scoring (formation attempts / stars). */
  teamMatchId?: EntityId;
  /** Lanes fully cleared this raid — used for war star table when teamMatchId is set. */
  lanesDestroyed?: number;
}

/** Response from POST /api/raids/garden/complete */
export interface GardenRaidCompleteResult {
  /** Wallet leaves granted for unlocked insects used in a victory. */
  leavesGranted: number;
  /** Wallet/leaf loot stolen from the defender garden (if any). */
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
  /** Continuous pending leaf available to steal / show. */
  pendingLeaf?: number;
  /** @deprecated Prefer pendingLeaf. Legacy leaf queue rows. */
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
  /** Defender defenseStrength for scout chip / parity. */
  defenseStrength?: number;
  /** Strength formula stamp (GDD 2.1). */
  balanceVersion?: string;
  mapTemplateId: EntityId;
  gardenLevel: number;
  placedPlants: GardenRaidPlacedPlant[];
  itemBox?: GardenRaidItemBox;
  scoutTimeoutSec: number;
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
  /** Leaves stolen from garden production (pending leaf / leaf queues). */
  stolenLeaf: number;
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

/**
 * Garden / live plunder stars from fully destroyed lanes only.
 * Formula: floor(maxStars * destroyed / total lanes).
 * On the standard five-lane board, each destroyed lane awards one star.
 * `lanesSecured` remains in the input for wire compatibility but has no score value.
 */
export function starsFromLaneProgress(input: {
  lanesDestroyed: number;
  lanesSecured: number;
  laneCount: number;
  maxStars?: number;
}): number {
  const destroyed = Math.max(0, Math.floor(input.lanesDestroyed));
  const total = Math.max(1, Math.floor(input.laneCount));
  const maxStars = Math.max(1, Math.floor(input.maxStars ?? GARDEN_RAID_MAX_STARS));
  return Math.min(maxStars, Math.floor((destroyed * maxStars) / total));
}

/** Next item-box bomb recharge after `useCount` prior fires this raid. */
export function gardenItemBoxNextRechargeSec(input: {
  baseRechargeSec: number;
  useCount: number;
  battleElapsedSec: number;
  ramp?: number;
  capSec?: number;
}): number {
  const base = Math.max(1, input.baseRechargeSec);
  const uses = Math.max(0, Math.floor(input.useCount));
  const elapsed = Math.max(0, input.battleElapsedSec);
  const ramp = Number.isFinite(input.ramp) ? Number(input.ramp) : GARDEN_ITEM_BOX_RECHARGE_RAMP;
  const cap = Number.isFinite(input.capSec) ? Number(input.capSec) : GARDEN_ITEM_BOX_RECHARGE_CAP_SEC;
  const raw = base * Math.pow(2, uses) + elapsed * ramp;
  return Math.min(Math.max(1, raw), Math.max(1, cap));
}

/** Steal share of eligible pending production for a given star count (0–5). */
export function gardenRaidStealShare(stars: number): number {
  const s = Math.max(0, Math.min(GARDEN_RAID_MAX_STARS, Math.floor(stars)));
  return Math.max(0, Math.min(1, GARDEN_RAID_STEAL_BASE + GARDEN_RAID_STEAL_PER_STAR * s));
}

/** Leaf spend refund multiplier for a given star count. */
export function gardenRaidLeafRefundMultiplier(stars: number): number {
  const s = Math.max(0, Math.min(GARDEN_RAID_MAX_STARS, Math.floor(stars)));
  return GARDEN_RAID_LEAF_REFUND_BY_STAR[s] ?? 0;
}

/** POST /api/raids/garden/test/ai-attack — run a full AI garden raid (testing). */
export interface SimulateAiGardenAttackRequest {
  /** Target garden owner; defaults to the authenticated user. */
  defenderUserId?: string;
  /** Optional override — otherwise outcome is simulated from garden strength. */
  stars?: number;
  victory?: boolean;
}
