import type { UnitCellAnchor } from './unit-sizing';

export const EGG_GROUP_SPECIAL_ID = 'egg_group';
export const LADDER_SPECIAL_ID = 'ladder';
export const INSECT_DETECTOR_SPECIAL_ID = 'insect_detector';
export const DEFAULT_EGG_SPAWN_INSECT_ID = 'aphid_nibbler';
export const DEFAULT_EGG_HATCH_INTERVAL_SECONDS = 10;
export const DEFAULT_LADDER_MAX_HEALTH = 100;
/** Damage of the detector's bolt per insect; the default kills anything on the lawn. */
export const DEFAULT_INSECT_DETECTOR_LIGHTNING_DAMAGE = 5000;
export const DEFAULT_INSECT_DETECTOR_JUMP_DELAY_SECONDS = 0.07;

/** Lawn special props (egg groups, ladders, insect detectors) authored in the editor. */
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
  /**
   * Insect Detector: damage of the lightning that hits every insect in the detector's lane
   * when an insect reaches it (it then burns out). Default kills.
   */
  lightningDamage?: number;
  /** Insect Detector: seconds between bolt hops from one insect to the next. */
  lightningJumpDelaySeconds?: number;
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

export function defaultInsectDetectorSpritePath(): string {
  return 'Special/InsectDetector';
}

/**
 * The lane's last line of defence (replaces the classic lawn mower): parked in the house
 * gutter of each lane; the first insect to reach it is met with a bolt that chains through
 * every insect in that lane, after which the detector burns out.
 */
export function defaultInsectDetectorDefinition(): SpecialDefinition {
  return {
    id: INSECT_DETECTOR_SPECIAL_ID,
    displayName: 'Insect Detector',
    sprite: defaultInsectDetectorSpritePath(),
    cellWidthFill: 0.8,
    lightningDamage: DEFAULT_INSECT_DETECTOR_LIGHTNING_DAMAGE,
    lightningJumpDelaySeconds: DEFAULT_INSECT_DETECTOR_JUMP_DELAY_SECONDS,
    schemaVersion: 2,
  };
}
