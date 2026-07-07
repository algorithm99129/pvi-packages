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

export interface PlantClientAssets {
  spriteSheet: string;
  icon: string;
  animationPrefix: string;
  attackEffect?: string;
  deathEffect?: string;
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

/** Exported to Cocos client — includes asset paths */
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
