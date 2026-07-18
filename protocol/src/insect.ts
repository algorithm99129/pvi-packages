import type { EntityId } from './index';
import type { WalletResources } from './wallet';

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
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
  stats: InsectStatCurve;
  client: InsectClientAssets;
  server: InsectServerConfig;
  /** Leveling and upgrade costs (formula-driven). */
  upgrade?: InsectUpgradeConfig;
}

/** Max insect level (roster upgrades). Matches DEFAULT_INSECT_UPGRADE.maxLevel. */
export const INSECT_MAX_LEVEL = 20;

/** Per-insect upgrade tuning — costs evaluated via logic.json formulas. */
export interface InsectUpgradeConfig {
  maxLevel: number;
  /** Formula id for stat at level (inputs: base, perLevel, level). */
  statFormulaId: string;
  /** Formula id for next-level upgrade cost per resource (inputs: base, level). */
  costFormulaId: string;
  baseUpgradeCost: WalletResources;
}

/** MVP: reuse plant formulas until nectar/chitin economy lands. */
export const DEFAULT_INSECT_UPGRADE: InsectUpgradeConfig = {
  maxLevel: INSECT_MAX_LEVEL,
  statFormulaId: 'plant_stat_at_level',
  costFormulaId: 'plant_upgrade_resource_cost',
  baseUpgradeCost: { coin: 100, gem: 0, leaf: 2 },
};

export function resolveInsectUpgrade(insect: Pick<InsectDefinition, 'upgrade'>): InsectUpgradeConfig {
  return insect.upgrade ?? DEFAULT_INSECT_UPGRADE;
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
import type { EntityStateGraph } from './entity-state-graph';
import { mirrorInsectClipsFromGraph } from './entity-state-graph';

export interface InsectClientAssets {
  /** PascalCase unit folder under Insects/, e.g. NormalZombie */
  folder: string;
  /**
   * @deprecated Prefer `stateGraph`. Mirrored from the walk / entry node.
   */
  walk: string;
  /** @deprecated Prefer stateGraph attack node. */
  attack?: string;
  /** @deprecated Prefer stateGraph.die.spineAnim. */
  die?: string;
  /** Status graph — statuses, AND conditions, and predefined engine actions. */
  stateGraph?: EntityStateGraph;
  extraAnimations?: GfxAnimationSlot[];
  cropX?: number;
  cropWidth?: number;
  crop?: GfxRectCrop;
  /** Fraction of grid cell width (0–1). Default 0.9. Height follows sprite aspect ratio. */
  cellWidthFill?: number;
  /** Extra multiplier applied after cell-width fitting. */
  scale?: number;
}

/** Persist graph and keep legacy walk/attack/die fields mirrored. */
export function withInsectStateGraph(
  client: InsectClientAssets,
  graph: EntityStateGraph,
): InsectClientAssets {
  const clips = mirrorInsectClipsFromGraph(graph);
  return {
    ...client,
    stateGraph: graph,
    walk: clips.walk || client.walk || client.folder,
    attack: clips.attack,
    die: clips.die,
  };
}

export interface InsectServerConfig {
  unlockSource: 'story' | 'goal' | 'event' | 'default';
  unlockRef?: string;
  laneBehavior: 'ground' | 'flying' | 'burrow';
  burrowSkipsPlants?: number;
}

export interface ServerInsectExport {
  id: EntityId;
  displayName: string;
  description: string;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  schemaVersion?: number;
  client: InsectClientAssets;
  stats: InsectStatCurve;
  server: InsectServerConfig;
  upgrade?: InsectUpgradeConfig;
}

export interface ClientInsectExport {
  id: EntityId;
  displayName: string;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  description: string;
  schemaVersion?: number;
  client: InsectClientAssets;
  stats: InsectStatCurve;
}
