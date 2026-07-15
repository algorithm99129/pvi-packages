import type { EntityId } from './index';
import type { InsectArchetype, InsectClientAssets, InsectStatCurve, InsectServerConfig } from './insect';
import type { PlantBehaviorConfig } from './plant-behavior';
import type {
  PlantClientAssets,
  PlantRole,
  PlantServerConfig,
  PlantStatCurve,
  PlantUpgradeConfig,
} from './plant';

/**
 * Combat stats after formula evaluation (server-authoritative).
 * For shooters, `damage` is derived from the referenced bullet's damage curve.
 */
export interface ResolvedPlantCombatStats {
  health: number;
  damage: number;
  attackIntervalMs: number;
  range: number;
}

export interface ResolvedInsectCombatStats {
  health: number;
  damage: number;
  attackIntervalMs: number;
  moveSpeed: number;
}

/**
 * Runtime plant catalog entry returned by GET /api/game-data/plants.
 * Includes display/gfx refs for clients; combat values in `resolvedStats`.
 */
export interface CatalogPlant {
  id: EntityId;
  displayName: string;
  description: string;
  role: PlantRole;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
  server: PlantServerConfig;
  upgrade?: PlantUpgradeConfig;
  /** Authoring curves — clients should use resolvedStats for combat. */
  stats: PlantStatCurve;
  resolvedStats: ResolvedPlantCombatStats;
  /** Level used to compute resolvedStats. */
  resolvedLevel: number;
}

/**
 * Runtime insect catalog entry returned by GET /api/game-data/insects.
 */
export interface CatalogInsect {
  id: EntityId;
  displayName: string;
  description: string;
  archetype: InsectArchetype;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  client: InsectClientAssets;
  server: InsectServerConfig;
  stats: InsectStatCurve;
  resolvedStats: ResolvedInsectCombatStats;
  resolvedLevel: number;
}
