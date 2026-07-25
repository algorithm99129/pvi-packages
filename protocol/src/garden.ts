import type { EntityId } from './index';
import type { ServerMapExport } from './map';
import type { WalletResources } from './wallet';

/** Max garden / village level. */
export const GARDEN_MAX_LEVEL = 20;

/** Default map for new gardens. */
export const DEFAULT_GARDEN_MAP_ID: EntityId = 'front_yard';

/** Formula id for garden level-up cost (coin/gem/leaf). */
export const GARDEN_UPGRADE_COST_FORMULA_ID = 'garden_upgrade_resource_cost';

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

export interface GardenPlantSlot {
  plantId: EntityId;
  lane: number;
  column: number;
}

export interface PlayerGarden {
  level: number;
  mapTemplateId: EntityId;
  layoutVersion: number;
  plants: GardenPlantSlot[];
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
}

export interface UpgradeGardenResult {
  garden: GardenView;
  wallet: WalletResources;
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
