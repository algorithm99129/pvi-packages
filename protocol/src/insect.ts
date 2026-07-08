import type { EntityId } from './index';

export type InsectArchetype =
  | 'swarm'
  | 'tank'
  | 'flyer'
  | 'burrower'
  | 'siege'
  | 'runner'
  | 'support';

export interface InsectDefinition {
  id: EntityId;
  displayName: string;
  archetype: InsectArchetype;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  stats: InsectStatCurve;
  client: InsectClientAssets;
  server: InsectServerConfig;
}

export interface InsectStatCurve {
  baseHealth: number;
  baseDamage: number;
  moveSpeed: number;
  attackIntervalMs: number;
  levelScaling: {
    healthPerLevel: number;
    damagePerLevel: number;
    milestones?: Record<number, { trait?: string }>;
  };
}

import type { GfxRectCrop, GfxAnimationSlot } from './gfx';

export interface InsectClientAssets {
  /** PascalCase unit folder under Insects/, e.g. NormalZombie */
  folder: string;
  /** Walk animation name (= subfolder under sprites/animations/) */
  walk: string;
  attack?: string;
  die?: string;
  extraAnimations?: GfxAnimationSlot[];
  cropX?: number;
  cropWidth?: number;
  crop?: GfxRectCrop;
  scale?: number;
}

export interface InsectServerConfig {
  unlockSource: 'story' | 'goal' | 'event' | 'default';
  unlockRef?: string;
  laneBehavior: 'ground' | 'flying' | 'burrow';
  burrowSkipsPlants?: number;
}

export interface ServerInsectExport {
  id: EntityId;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  stats: InsectStatCurve;
  server: InsectServerConfig;
}

export interface ClientInsectExport {
  id: EntityId;
  displayName: string;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  description: string;
  client: InsectClientAssets;
  stats: InsectStatCurve;
}
