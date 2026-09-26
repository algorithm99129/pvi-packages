import type { UnitCellAnchor } from './unit-sizing';

export const EGG_GROUP_SPECIAL_ID = 'egg_group';
export const LADDER_SPECIAL_ID = 'ladder';
export const DEFAULT_EGG_SPAWN_INSECT_ID = 'aphid_nibbler';
export const DEFAULT_EGG_HATCH_INTERVAL_SECONDS = 10;
export const DEFAULT_LADDER_MAX_HEALTH = 100;

/** Lawn special props (egg groups, ladders, etc.) authored in the editor. */
export interface SpecialDefinition {
  id: string;
  displayName: string;
  /** Resources path without extension, e.g. `Special/EggGroup`. */
  sprite: string;
  cellAnchor?: UnitCellAnchor;
  /** @deprecated Prefer cellAnchor. */
  cellWidthFill?: number;
  scale?: number;
  /**
   * Catalog insect id that rises from each egg group on a timer
   * (Dirty Egg Group → Aphid Nibbler).
   */
  spawnInsectId?: string;
  /** Seconds between hatches from each egg group. */
  hatchIntervalSeconds?: number;
  /** Hit points for destructible props (Climbing Ladder). */
  maxHealth?: number;
  schemaVersion?: number;
}

export function defaultEggGroupSpritePath(): string {
  return 'Special/EggGroup';
}

export function defaultLadderSpritePath(): string {
  return 'Special/Ladder';
}

export function defaultEggGroupDefinition(): SpecialDefinition {
  return {
    id: EGG_GROUP_SPECIAL_ID,
    displayName: 'Dirty Egg Group',
    sprite: defaultEggGroupSpritePath(),
    cellWidthFill: 0.82,
    spawnInsectId: DEFAULT_EGG_SPAWN_INSECT_ID,
    hatchIntervalSeconds: DEFAULT_EGG_HATCH_INTERVAL_SECONDS,
    schemaVersion: 2,
  };
}

export function defaultLadderDefinition(): SpecialDefinition {
  return {
    id: LADDER_SPECIAL_ID,
    displayName: 'Climbing Ladder',
    sprite: defaultLadderSpritePath(),
    cellWidthFill: 0.7,
    maxHealth: DEFAULT_LADDER_MAX_HEALTH,
    schemaVersion: 2,
  };
}
