import type { EntityId } from './index';
import type { WalletResources } from './wallet';

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
  /** Leveling and upgrade costs (formula-driven). */
  upgrade?: PlantUpgradeConfig;
  /** Optional combat behavior overrides (see resolvePlantBehavior). */
  behavior?: PlantBehaviorConfig;
}

/** Per-plant upgrade tuning — costs evaluated via logic.json formulas. */
export interface PlantUpgradeConfig {
  maxLevel: number;
  /** Formula id for stat at level (inputs: base, perLevel, level). */
  statFormulaId: string;
  /** Formula id for next-level upgrade cost per resource (inputs: base, level). */
  costFormulaId: string;
  baseUpgradeCost: WalletResources;
}

export const DEFAULT_PLANT_UPGRADE: PlantUpgradeConfig = {
  maxLevel: 20,
  statFormulaId: 'plant_stat_at_level',
  costFormulaId: 'plant_upgrade_resource_cost',
  baseUpgradeCost: { coin: 100, gem: 0, leaf: 2 },
};

export function resolvePlantUpgrade(plant: Pick<PlantDefinition, 'upgrade'>): PlantUpgradeConfig {
  return plant.upgrade ?? DEFAULT_PLANT_UPGRADE;
}

export interface PlantStatCurve {
  baseHealth: number;
  /**
   * Contact / explode / melee damage for non-shooters.
   * Shooters inherit damage from the referenced bullet at resolve time — this field is ignored then.
   */
  baseDamage: number;
  attackIntervalMs: number;
  range: number;
  /** level → multiplier or milestone overrides */
  levelScaling: {
    healthPerLevel: number;
    /** Used for non-shooters; shooters use bullet.stats.damagePerLevel. */
    damagePerLevel: number;
    milestones?: Record<number, { trait?: string; bonusDamage?: number; pierce?: number }>;
  };
}

import type { GfxRectCrop, GfxAnimationSlot } from './gfx';
import type { PlantBehaviorConfig } from './plant-behavior';
import type { EntityStateGraph } from './entity-state-graph';
import { mirrorPlantClipsFromGraph } from './entity-state-graph';

/** Normalized point on the plant sprite (0–1 from bottom-left of displayed bounds). */
export interface PlantBulletSpawnPoint {
  /** 0 = left edge, 1 = right edge of plant width */
  x: number;
  /** 0 = bottom edge, 1 = top edge of plant height */
  y: number;
}

/** How a projectile leaves the plant. */
export type BulletTrajectory = 'linear' | 'curved';

/**
 * One projectile in a volley. Direction 0° = right (lane-forward), increasing CCW.
 * Curved shots bake an aiming point at fire time from the enemy — do not author `target` into plant JSON.
 */
export interface PlantBulletShot {
  /** Stable id for editor list selection. */
  id: string;
  spawn: PlantBulletSpawnPoint;
  /** Degrees; 0 = right / forward along the lane, CCW positive. */
  directionDeg: number;
  trajectory: BulletTrajectory;
  /**
   * @deprecated Not persisted. Combat bakes aim at fire; editor keeps a preview Aim in UI state only.
   */
  target?: PlantBulletSpawnPoint;
  /** Curved only: arc height as a fraction of horizontal span (default 0.35). */
  arcHeight?: number;
  /** Delay after volley start (ms) for Repeater-style stagger. */
  delayMs?: number;
}

export const DEFAULT_PLANT_BULLET_SPAWN: PlantBulletSpawnPoint = { x: 0.75, y: 0.5 };
export const DEFAULT_BULLET_ARC_HEIGHT = 0.35;

export function plantSupportsBullets(role: PlantRole): boolean {
  return role === 'shooter';
}

export function resolveBulletSpawn(client: PlantClientAssets): PlantBulletSpawnPoint {
  const shots = resolveBulletShots(client);
  return shots[0]?.spawn ?? DEFAULT_PLANT_BULLET_SPAWN;
}

/** Build a new shot with sensible defaults (optionally cloning spawn from an existing shot). */
export function createBulletShot(
  partial?: Partial<PlantBulletShot>,
  idFactory: () => string = () => `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
): PlantBulletShot {
  const spawn = sanitizePoint(partial?.spawn ?? DEFAULT_PLANT_BULLET_SPAWN, DEFAULT_PLANT_BULLET_SPAWN);
  const trajectory = partial?.trajectory === 'curved' ? 'curved' : 'linear';
  const shot: PlantBulletShot = {
    id: partial?.id && partial.id.length > 0 ? partial.id : idFactory(),
    spawn,
    directionDeg: Number.isFinite(partial?.directionDeg) ? (partial!.directionDeg as number) : 0,
    trajectory,
    delayMs: Math.max(0, Math.floor(partial?.delayMs ?? 0)),
  };
  if (trajectory === 'curved') {
    shot.arcHeight =
      Number.isFinite(partial?.arcHeight) && (partial!.arcHeight as number) >= 0
        ? (partial!.arcHeight as number)
        : DEFAULT_BULLET_ARC_HEIGHT;
  }
  return shot;
}

/**
 * Resolve the authored volley. Migrates legacy `bulletSpawn` into one linear shot when
 * `bulletShots` is missing/empty.
 */
export function resolveBulletShots(client: PlantClientAssets): PlantBulletShot[] {
  if (client.bulletShots && client.bulletShots.length > 0) {
    return client.bulletShots.map((s) =>
      createBulletShot(s, () => s.id || `shot_${Math.random().toString(36).slice(2, 9)}`),
    );
  }
  if (client.bulletSpawn) {
    return [
      createBulletShot({
        id: 'legacy_spawn',
        spawn: {
          x: clampCoord(client.bulletSpawn.x, DEFAULT_PLANT_BULLET_SPAWN.x),
          y: clampCoord(client.bulletSpawn.y, DEFAULT_PLANT_BULLET_SPAWN.y),
        },
        directionDeg: 0,
        trajectory: 'linear',
        delayMs: 0,
      }),
    ];
  }
  return [createBulletShot({ id: 'default_spawn' })];
}

/** Persist shots and keep deprecated `bulletSpawn` mirrored to the first shot for older readers. */
export function withBulletShots(
  client: PlantClientAssets,
  shots: PlantBulletShot[],
): PlantClientAssets {
  const normalized = shots.map((s) => {
    const next = createBulletShot(s, () => s.id);
    // Never persist preview aim points — combat bakes from the enemy at fire.
    delete next.target;
    return next;
  });
  const first = normalized[0];
  return {
    ...client,
    bulletShots: normalized,
    bulletSpawn: first ? { ...first.spawn } : undefined,
  };
}

function sanitizePoint(
  point: PlantBulletSpawnPoint | undefined,
  fallback: PlantBulletSpawnPoint,
  allowOutside = false,
): PlantBulletSpawnPoint {
  if (!point) return { ...fallback };
  return {
    x: clampCoord(point.x, fallback.x, allowOutside),
    y: clampCoord(point.y, fallback.y, allowOutside),
  };
}

function clampCoord(value: number, fallback: number, allowOutside = false): number {
  if (!Number.isFinite(value)) return fallback;
  if (allowOutside) return Math.min(2.5, Math.max(-0.25, value));
  return Math.min(1, Math.max(0, value));
}

export interface PlantClientAssets {
  /** PascalCase unit folder under Plants/, e.g. CherryBomb */
  folder: string;
  /**
   * @deprecated Prefer `stateGraph`. Mirrored from the graph entry / idle node for older readers.
   */
  idle: string;
  /** @deprecated Prefer stateGraph init node. */
  init?: string;
  /** @deprecated Prefer stateGraph aim node. */
  aim?: string;
  /** @deprecated Prefer stateGraph attack node. */
  attack?: string;
  /** @deprecated Prefer stateGraph.die.spineAnim. */
  die?: string;
  /**
   * Status graph — primary authoring for gameplay statuses, conditions, and
   * predefined engine actions. Spine clips are optional per status.
   * Die is configured on the graph (not edged); HP≤0 always enters die.
   */
  stateGraph?: EntityStateGraph;
  /** Bullet folder under Bullets/, e.g. Pea */
  bullet?: string;
  /**
   * @deprecated Prefer `bulletShots`. Kept in sync with `bulletShots[0].spawn` for older readers.
   */
  bulletSpawn?: PlantBulletSpawnPoint;
  /** Projectiles emitted in one attack volley. */
  bulletShots?: PlantBulletShot[];
  extraAnimations?: GfxAnimationSlot[];
  crop?: GfxRectCrop;
  /** Fraction of grid cell width (0–1). Default 0.8. Height follows sprite aspect ratio. */
  cellWidthFill?: number;
  /** Extra multiplier applied after cell-width fitting. */
  scale?: number;
}

/** Persist graph and keep legacy idle/attack/… fields mirrored. */
export function withPlantStateGraph(
  client: PlantClientAssets,
  graph: EntityStateGraph,
): PlantClientAssets {
  const clips = mirrorPlantClipsFromGraph(graph);
  return {
    ...client,
    stateGraph: graph,
    idle: clips.idle || client.idle || client.folder,
    init: clips.init,
    aim: clips.aim,
    attack: clips.attack,
    die: clips.die,
  };
}

export interface PlantServerConfig {
  unlockSource: 'story' | 'goal' | 'event' | 'default';
  unlockRef?: string;
  targetingPriority: 'closest' | 'lowest_hp' | 'flying_first';
  validTerrain: Array<'ground' | 'water' | 'pot'>;
}

/** Exported to server / API — balance + display/gfx refs for runtime catalog */
export interface ServerPlantExport {
  id: EntityId;
  displayName: string;
  description: string;
  role: PlantRole;
  rarity: PlantDefinition['rarity'];
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
  stats: PlantStatCurve;
  server: PlantServerConfig;
  upgrade?: PlantUpgradeConfig;
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
  behavior?: PlantBehaviorConfig;
}
