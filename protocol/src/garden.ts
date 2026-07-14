import type { EntityId } from './index';
import type { ServerMapExport } from './map';
import type { WalletResources } from './wallet';

/** Max garden / village level. */
export const GARDEN_MAX_LEVEL = 20;

/** Default map for new gardens. */
export const DEFAULT_GARDEN_MAP_ID: EntityId = 'front_yard';

/** Formula id for garden level-up cost (coin/gem/leaf). */
export const GARDEN_UPGRADE_COST_FORMULA_ID = 'garden_upgrade_resource_cost';

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
