import type { EntityId } from './index';

export type PlantRole =
  | 'shooter'
  | 'splash'
  | 'blocker'
  | 'trap'
  | 'support'
  | 'disruptor'
  | 'anti_air'
  | 'utility';

/** Editor / game-data source definition (full authoring data) */
export interface PlantDefinition {
  id: EntityId;
  displayName: string;
  role: PlantRole;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  /** Combat stats per level — server authoritative */
  stats: PlantStatCurve;
  /** Client-only presentation */
  client: PlantClientAssets;
  /** Server-only rules */
  server: PlantServerConfig;
}

export interface PlantStatCurve {
  baseHealth: number;
  baseDamage: number;
  attackIntervalMs: number;
  range: number;
  /** level → multiplier or milestone overrides */
  levelScaling: {
    healthPerLevel: number;
    damagePerLevel: number;
    milestones?: Record<number, { trait?: string; bonusDamage?: number; pierce?: number }>;
  };
}

import type { GfxRectCrop, GfxAnimationSlot } from './gfx';

/** Normalized spawn point on the plant sprite (0–1 from bottom-left of displayed bounds). */
export interface PlantBulletSpawnPoint {
  /** 0 = left edge, 1 = right edge of plant width */
  x: number;
  /** 0 = bottom edge, 1 = top edge of plant height */
  y: number;
}

export const DEFAULT_PLANT_BULLET_SPAWN: PlantBulletSpawnPoint = { x: 0.75, y: 0.5 };

export function plantSupportsBullets(role: PlantRole): boolean {
  return role === 'shooter' || role === 'splash';
}

export function resolveBulletSpawn(client: PlantClientAssets): PlantBulletSpawnPoint {
  const spawn = client.bulletSpawn;
  if (!spawn) return DEFAULT_PLANT_BULLET_SPAWN;
  return {
    x: clampSpawnCoord(spawn.x, DEFAULT_PLANT_BULLET_SPAWN.x),
    y: clampSpawnCoord(spawn.y, DEFAULT_PLANT_BULLET_SPAWN.y),
  };
}

function clampSpawnCoord(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export interface PlantClientAssets {
  /** PascalCase unit folder under Plants/, e.g. CherryBomb */
  folder: string;
  /** Idle animation name (= subfolder under sprites/animations/) */
  idle: string;
  attack?: string;
  die?: string;
  /** Bullet folder under Bullets/, e.g. PeaNormal */
  bullet?: string;
  /** Where projectiles emit from, as % of plant width/height (bottom-left origin). */
  bulletSpawn?: PlantBulletSpawnPoint;
  extraAnimations?: GfxAnimationSlot[];
  crop?: GfxRectCrop;
  scale?: number;
}

export interface PlantServerConfig {
  unlockSource: 'story' | 'goal' | 'event' | 'default';
  unlockRef?: string;
  targetingPriority: 'closest' | 'lowest_hp' | 'flying_first';
  validTerrain: Array<'ground' | 'water' | 'pot'>;
}

/** Exported to server — no graphics */
export interface ServerPlantExport {
  id: EntityId;
  role: PlantRole;
  rarity: PlantDefinition['rarity'];
  stats: PlantStatCurve;
  server: PlantServerConfig;
}

/** Exported to Unity client — includes asset paths */
export interface ClientPlantExport {
  id: EntityId;
  displayName: string;
  role: PlantRole;
  rarity: PlantDefinition['rarity'];
  description: string;
  client: PlantClientAssets;
  /** Combat stats needed for local sim preview in editor */
  stats: PlantStatCurve;
}
