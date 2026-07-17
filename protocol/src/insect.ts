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
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
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
