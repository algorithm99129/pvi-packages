import type { EntityId } from './index';
import type { ServerMapExport } from './map';
import type { PlantServerConfig } from './plant';
import type { WalletResources } from './wallet';

/** Max garden / village level. */
export const GARDEN_MAX_LEVEL = 20;

/** Default map for new gardens. */
export const DEFAULT_GARDEN_MAP_ID: EntityId = 'front_yard';

/** Formula id for garden level-up cost (coin/gem/leaf). */
export const GARDEN_UPGRADE_COST_FORMULA_ID = 'garden_upgrade_resource_cost';

/** Dig-up refunds this fraction of the current place coin cost (server-authoritative). */
export const GARDEN_DIG_REFUND_RATIO = 0.5;

/** Default max hours of unclaimed garden production accrual per slot. */
export const GARDEN_PRODUCTION_DEFAULT_MAX_ACCRUAL_HOURS = 8;

/** Default upgrade cards / hour for planted plants when not authored. */
export const GARDEN_PRODUCTION_DEFAULT_UPGRADE_CARDS_PER_HOUR = 1;

/** Default max pending production pickups queued per planted plant. */
export const GARDEN_PRODUCTION_DEFAULT_MAX_QUEUE = 10;

/** Max village item-box slots for instant / squash defense charges. */
export const GARDEN_ITEM_BOX_MAX_SLOTS = 3;

/**
 * Village level required to unlock item-box slot index 0..2.
 * Slot 0 is always available at level 1.
 */
export const GARDEN_ITEM_BOX_LEVEL_UNLOCKS: readonly number[] = [1, 5, 10];

/**
 * Gem cost to unlock slot index 0..2 early (slot 0 is free).
 * Paying gems bumps {@link GardenItemBox.gemUnlockedExtra}.
 */
export const GARDEN_ITEM_BOX_GEM_UNLOCK_COSTS: readonly number[] = [0, 50, 100];

/** Plant ids that live in the item box (never on the permanent lawn grid). */
export const GARDEN_ITEM_BOX_PLANT_IDS = new Set([
  'cherry_bomb',
  'jalapeno',
  'ice_shroom',
  'doom_shroom',
  'squash',
]);

/**
 * True when this plant is a village item-box charge (instant explode + squash),
 * not a permanent garden grid station.
 */
export function isGardenItemBoxPlant(plant: {
  id?: string | null;
  behavior?: { kind?: string | null } | null;
}): boolean {
  const id = String(plant.id ?? '').trim().toLowerCase();
  if (id && GARDEN_ITEM_BOX_PLANT_IDS.has(id)) return true;
  const kind = String(plant.behavior?.kind ?? '').trim().toLowerCase();
  return kind === 'instant_explode';
}

/** How many item-box slots village level alone unlocks (1..{@link GARDEN_ITEM_BOX_MAX_SLOTS}). */
export function gardenItemBoxLevelUnlockedCount(villageLevel: number): number {
  const level = Math.max(1, Math.floor(villageLevel || 1));
  let count = 0;
  for (let i = 0; i < GARDEN_ITEM_BOX_LEVEL_UNLOCKS.length; i++) {
    if (level >= GARDEN_ITEM_BOX_LEVEL_UNLOCKS[i]!) count = i + 1;
  }
  return Math.min(GARDEN_ITEM_BOX_MAX_SLOTS, Math.max(1, count));
}

/**
 * Effective unlocked slot count = max(level unlocks, 1 + gem extras), capped at max.
 */
export function resolveGardenItemBoxUnlockedCount(input: {
  villageLevel: number;
  gemUnlockedExtra?: number | null;
}): number {
  const byLevel = gardenItemBoxLevelUnlockedCount(input.villageLevel);
  const gemExtra = Math.max(0, Math.floor(Number(input.gemUnlockedExtra) || 0));
  return Math.min(GARDEN_ITEM_BOX_MAX_SLOTS, Math.max(byLevel, 1 + gemExtra));
}

/** Gem price to unlock the next locked slot, or null if fully unlocked. */
export function gardenItemBoxNextGemUnlockCost(input: {
  villageLevel: number;
  gemUnlockedExtra?: number | null;
}): number | null {
  const unlocked = resolveGardenItemBoxUnlockedCount(input);
  if (unlocked >= GARDEN_ITEM_BOX_MAX_SLOTS) return null;
  const cost = GARDEN_ITEM_BOX_GEM_UNLOCK_COSTS[unlocked] ?? 0;
  return cost > 0 ? cost : null;
}

export function buildEmptyGardenItemBox(): GardenItemBox {
  return {
    gemUnlockedExtra: 0,
    slots: Array.from({ length: GARDEN_ITEM_BOX_MAX_SLOTS }, () => ({})),
  };
}

export type GardenProductionPickupKind = 'coin' | 'gem' | 'upgrade_card';

/** One click-to-collect production item sitting on a planted garden plant. */
export interface GardenProductionPickup {
  id: string;
  kind: GardenProductionPickupKind;
  /** Coin/gem amount, or upgrade-card count for this pickup. */
  amount: number;
  /** Plant type for upgrade_card pickups (usually the slot plant). */
  plantId?: EntityId;
  createdAt: string;
}

export interface GardenPlantSlot {
  plantId: EntityId;
  lane: number;
  column: number;
  /** ISO timestamp when placed / last production accrual for this slot. */
  plantedAt?: string;
  /** Pending click-to-collect rewards (not yet in wallet / roster). */
  productionQueue?: GardenProductionPickup[];
}

/**
 * Coin cost to station one plant on the village layout.
 * Mirrors classic seed-packet tiers (producer/wall cheap, explode expensive).
 */
export function gardenPlantPlaceCoinCost(input: {
  role?: string | null;
  rarity?: string | null;
  plantLevel?: number | null;
}): number {
  const role = (input.role ?? '').trim().toLowerCase();
  let base = 100;
  switch (role) {
    case 'producer':
    case 'wall':
    case 'blocker':
      base = 50;
      break;
    case 'support':
      base = 75;
      break;
    case 'trap':
    case 'splash':
      base = 125;
      break;
    case 'instant':
    case 'explode':
      base = 150;
      break;
    default:
      base = 100;
  }

  const rarity = (input.rarity ?? 'common').trim().toLowerCase();
  let rarityMult = 1;
  if (rarity === 'uncommon') rarityMult = 1.1;
  else if (rarity === 'rare') rarityMult = 1.25;
  else if (rarity === 'epic') rarityMult = 1.5;
  else if (rarity === 'legendary') rarityMult = 2;

  const level = Math.max(1, Math.floor(input.plantLevel ?? 1));
  const levelMult = 1 + (level - 1) * 0.05;
  return Math.max(1, Math.round(base * rarityMult * levelMult));
}

/**
 * Minimum village level to station a plant in the garden.
 * Authored `server.minVillageLevel` wins; otherwise rarity tiers.
 */
export function resolveGardenMinVillageLevel(plant: {
  rarity?: string | null;
  server?: Pick<PlantServerConfig, 'minVillageLevel'> | null;
}): number {
  const authored = plant.server?.minVillageLevel;
  if (typeof authored === 'number' && Number.isFinite(authored) && authored >= 1) {
    return Math.min(GARDEN_MAX_LEVEL, Math.floor(authored));
  }

  switch ((plant.rarity ?? 'common').trim().toLowerCase()) {
    case 'uncommon':
      return 2;
    case 'rare':
      return 4;
    case 'epic':
      return 7;
    case 'legendary':
      return 10;
    default:
      return 1;
  }
}

/** Coins returned when digging up a placed plant (half place cost, floored). */
export function gardenPlantDigRefundCoinCost(placeCoinCost: number): number {
  const cost = Math.max(0, Math.floor(placeCoinCost));
  return Math.max(0, Math.floor(cost * GARDEN_DIG_REFUND_RATIO));
}

/** One village item-box charge slot (instant / squash). */
export interface GardenItemBoxSlot {
  plantId?: EntityId;
  /** ISO timestamp when the slot is ready to auto-deploy again; omit = ready. */
  readyAt?: string;
}

/** Village item box for consumable defense charges (not lawn stations). */
export interface GardenItemBox {
  /**
   * Extra slots unlocked with gems beyond village-level unlocks (0–2).
   * Effective unlock count uses {@link resolveGardenItemBoxUnlockedCount}.
   */
  gemUnlockedExtra?: number;
  /** Always length {@link GARDEN_ITEM_BOX_MAX_SLOTS}; only first unlockedCount are usable. */
  slots: GardenItemBoxSlot[];
}

export interface GardenItemBoxSlotView extends GardenItemBoxSlot {
  /** Roster level when a plant is assigned. */
  level?: number;
  placeCoinCost?: number;
  /** True when this slot index is unlocked for the current garden. */
  unlocked: boolean;
  /**
   * How this slot becomes available when locked:
   * - `level` — reach village level threshold
   * - `gem` — can buy early with gems
   * - `none` — already unlocked / N/A
   */
  unlockHint?: 'level' | 'gem' | 'none';
  /** Village level required for this slot index. */
  unlockVillageLevel?: number;
  /** Gem cost to unlock this slot early (0 if free / already unlocked). */
  unlockGemCost?: number;
}

export interface GardenItemBoxView {
  gemUnlockedExtra: number;
  unlockedCount: number;
  /** Next gem unlock cost, or null if maxed / only level remains with cost 0. */
  nextUnlockGemCost: number | null;
  slots: GardenItemBoxSlotView[];
}

export interface PlayerGarden {
  level: number;
  mapTemplateId: EntityId;
  layoutVersion: number;
  /**
   * Permanent lawn stations. Must NOT include {@link isGardenItemBoxPlant} types —
   * those live in {@link itemBox}.
   */
  plants: GardenPlantSlot[];
  /** Instant / squash defense charges for village raids. */
  itemBox?: GardenItemBox;
  /** Map templates the player has purchased (always includes {@link DEFAULT_GARDEN_MAP_ID}). */
  ownedMapIds?: EntityId[];
}

export interface GardenMapShopEntry {
  mapTemplateId: EntityId;
  displayName: string;
  owned: boolean;
  equipped: boolean;
  /** True when garden level is within the map's min/max village range. */
  unlockedByLevel: boolean;
  priceCoin: number;
  priceGem: number;
  minVillageLevel: number;
  maxVillageLevel: number;
}

export interface GardenPlacedPlantView extends GardenPlantSlot {
  /** Roster level for this plant type. */
  level: number;
  stats: {
    health: number;
    damage: number;
    attackIntervalMs: number;
    range: number;
  };
  /** Coin paid / refundable for this placement (current formula). */
  placeCoinCost: number;
}

export interface GardenView {
  level: number;
  mapTemplateId: EntityId;
  layoutVersion: number;
  /** Cost to raise garden level by 1, or null if at max. */
  upgradeCost: WalletResources | null;
  map: ServerMapExport;
  plants: GardenPlacedPlantView[];
  itemBox: GardenItemBoxView;
  ownedMapIds: EntityId[];
  availableMaps: GardenMapShopEntry[];
}

/** GET /garden response (accrues production into plant queues; does not auto-grant). */
export interface GardenLoadResult {
  garden: GardenView;
  wallet: WalletResources;
}

/** POST /garden/production/collect */
export interface CollectGardenProductionRequest {
  pickupIds: string[];
}

export interface CollectGardenProductionResult {
  garden: GardenView;
  wallet: WalletResources;
  collected: GardenProductionPickup[];
}

export interface UpgradeGardenResult {
  garden: GardenView;
  wallet: WalletResources;
}

export interface PurchaseGardenMapResult {
  garden: GardenView;
  wallet: WalletResources;
}

export interface PurchaseGardenMapRequest {
  mapTemplateId: EntityId;
}

/** Response after placing a defense plant (coins spent). */
export interface PlaceGardenPlantResult {
  garden: GardenView;
  wallet: WalletResources;
  /** Coins deducted for this placement. */
  placeCost: WalletResources;
}

/** Response after removing a defense plant (coins refunded). */
export interface RemoveGardenPlantResult {
  garden: GardenView;
  wallet: WalletResources;
  /** Coins returned for this removal. */
  refund: WalletResources;
}

export interface PlaceGardenPlantRequest {
  plantId: EntityId;
  lane: number;
  column: number;
}

export interface RemoveGardenPlantRequest {
  lane: number;
  column: number;
}

export interface ChangeGardenMapRequest {
  mapTemplateId: EntityId;
}

export interface AssignGardenItemBoxSlotRequest {
  slotIndex: number;
  plantId: EntityId;
}

export interface RemoveGardenItemBoxSlotRequest {
  slotIndex: number;
}

/** Response after assigning / removing / unlocking an item-box slot. */
export interface GardenItemBoxMutationResult {
  garden: GardenView;
  wallet: WalletResources;
  placeCost?: WalletResources;
  refund?: WalletResources;
  unlockCost?: WalletResources;
}
