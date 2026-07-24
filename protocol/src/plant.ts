import type { EntityId } from './index';
import type { WalletResources } from './wallet';
import type { InsectTravelLayer } from './insect';

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
  /**
   * JSON schema generation for this definition. Missing = legacy (0).
   * Migrators bump this when loading/saving through the editor.
   */
  schemaVersion?: number;
  /** Combat stats per level — server authoritative */
  stats: PlantStatCurve;
  /** Client-only presentation */
  client: PlantClientAssets;
  /** Server-only rules */
  server: PlantServerConfig;
  /** Leveling and upgrade costs (formula-driven). */
  upgrade?: PlantUpgradeConfig;
  /**
   * Optional combat behavior overrides (legacy — prefer status graph + extraAttributes).
   * @deprecated Prefer extraAttributes + state graph.
   */
  behavior?: PlantBehaviorConfig;
  /** Per-unit knobs addressable as `extra.<key>` in the status graph. */
  extraAttributes?: ExtraAttributes;
}

/** Max plant level (roster upgrades). Matches DEFAULT_PLANT_UPGRADE.maxLevel. */
export const PLANT_MAX_LEVEL = 20;

/** Stars shown on plant/insect cards (UI), mapped from level. */
export const UNIT_CARD_MAX_STARS = 5;

/**
 * Levels 1–5 show no stars. Levels 6–20 map evenly onto 1–5 stars
 * (6–8 → 1★ … 18–20 → 5★).
 */
export function unitCardStarsFromLevel(level: number): number {
  const clamped = Math.max(1, Math.min(PLANT_MAX_LEVEL, Math.floor(Number(level)) || 1));
  if (clamped <= 5) return 0;
  return Math.min(UNIT_CARD_MAX_STARS, Math.ceil((clamped - 5) / 3));
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
  maxLevel: PLANT_MAX_LEVEL,
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
import type { ExtraAttributes } from './extra-attributes';
import type { EntityStateGraph } from './entity-state-graph';
import { mirrorPlantClipsFromGraph } from './entity-state-graph';
import type { UnitCellAnchor } from './unit-sizing';

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
  /**
   * Relative lane offset for parallel multi-lane volleys (e.g. Threepeater: -1, 0, +1).
   * 0 = shooter's lane. Combat skips shots that land off the map.
   */
  laneOffset?: number;
}

export const DEFAULT_PLANT_BULLET_SPAWN: PlantBulletSpawnPoint = { x: 0.75, y: 0.5 };
export const DEFAULT_BULLET_ARC_HEIGHT = 0.35;

/**
 * One entry in a plant's projectile pool.
 * Each shot rolls among choices using relative weights (chance = weight / sum).
 */
export interface PlantBulletChoice {
  /** Bullet folder or id (same refs as legacy `client.bullet`). */
  bullet: string;
  /** Relative weight; must be > 0. Equal weights → equal chance. */
  weight: number;
}

export function plantSupportsBullets(role: PlantRole): boolean {
  return role === 'shooter';
}

function normalizeBulletChoice(raw: Partial<PlantBulletChoice> | undefined): PlantBulletChoice | null {
  if (!raw) return null;
  const bullet = typeof raw.bullet === 'string' ? raw.bullet.trim() : '';
  if (!bullet) return null;
  const weight =
    Number.isFinite(raw.weight) && (raw.weight as number) > 0 ? (raw.weight as number) : 1;
  return { bullet, weight };
}

/**
 * Authoritative projectile pool. Migrates legacy single `bullet` into one choice.
 */
export function resolveBulletChoices(client: PlantClientAssets): PlantBulletChoice[] {
  if (client.bulletChoices && client.bulletChoices.length > 0) {
    const cleaned = client.bulletChoices
      .map((c) => normalizeBulletChoice(c))
      .filter((c): c is PlantBulletChoice => c != null);
    if (cleaned.length > 0) return cleaned;
  }
  if (client.bullet && client.bullet.trim().length > 0) {
    return [{ bullet: client.bullet.trim(), weight: 1 }];
  }
  return [];
}

/** Highest-weight choice (ties → first) — used for damage preview / legacy `bullet`. */
export function primaryBulletRef(client: PlantClientAssets): string | undefined {
  const choices = resolveBulletChoices(client);
  if (choices.length === 0) return undefined;
  let best = choices[0];
  for (let i = 1; i < choices.length; i++) {
    if (choices[i].weight > best.weight) best = choices[i];
  }
  return best.bullet;
}

/** Persist choices and mirror `bullet` to the primary entry for older readers. */
export function withBulletChoices(
  client: PlantClientAssets,
  choices: PlantBulletChoice[],
): PlantClientAssets {
  const normalized = choices
    .map((c) => normalizeBulletChoice(c))
    .filter((c): c is PlantBulletChoice => c != null);
  const primary =
    normalized.length === 0
      ? undefined
      : normalized.reduce((best, c) => (c.weight > best.weight ? c : best), normalized[0]);
  return {
    ...client,
    bulletChoices: normalized.length > 0 ? normalized : undefined,
    bullet: primary?.bullet,
  };
}

/**
 * Weighted pick. `random01` in [0, 1) — pass a seeded RNG in tests.
 */
export function pickBulletChoice(
  choices: PlantBulletChoice[],
  random01: number = Math.random(),
): PlantBulletChoice | undefined {
  if (choices.length === 0) return undefined;
  if (choices.length === 1) return choices[0];
  const total = choices.reduce((sum, c) => sum + c.weight, 0);
  if (!(total > 0)) return choices[0];
  let r = Math.min(0.999999, Math.max(0, random01)) * total;
  for (const c of choices) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return choices[choices.length - 1];
}

/** Display chance 0–100 for a choice index. */
export function bulletChoiceChancePercent(choices: PlantBulletChoice[], index: number): number {
  if (!choices[index]) return 0;
  const total = choices.reduce((sum, c) => sum + c.weight, 0);
  if (!(total > 0)) return 0;
  return (choices[index].weight / total) * 100;
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
  if (Number.isFinite(partial?.laneOffset) && (partial!.laneOffset as number) !== 0) {
    shot.laneOffset = Math.trunc(partial!.laneOffset as number);
  }
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
  /** Bullet folder under Bullets/, e.g. Pea.
   * @deprecated Prefer `bulletChoices`. Mirrored from the highest-weight choice.
   */
  bullet?: string;
  /**
   * Weighted projectile pool. Each volley shot rolls among these by weight.
   * When empty, falls back to legacy `bullet`.
   */
  bulletChoices?: PlantBulletChoice[];
  /**
   * @deprecated Prefer `bulletShots`. Kept in sync with `bulletShots[0].spawn` for older readers.
   */
  bulletSpawn?: PlantBulletSpawnPoint;
  /** Projectiles emitted in one attack volley. */
  bulletShots?: PlantBulletShot[];
  extraAnimations?: GfxAnimationSlot[];
  crop?: GfxRectCrop;
  /**
   * Art placement inside one grid cell (0–1 anchors, bottom-left origin).
   * Prefer this over legacy `cellWidthFill` / `scale`.
   */
  cellAnchor?: UnitCellAnchor;
  /**
   * @deprecated Prefer `cellAnchor`. Fraction of grid cell width (0–1).
   * Kept in sync with `cellAnchor.maxX - cellAnchor.minX` when the editor saves.
   */
  cellWidthFill?: number;
  /**
   * @deprecated Prefer `cellAnchor`. Extra multiplier after cell-width fitting.
   */
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
  /**
   * Which insect travel layers this plant can damage / target.
   * Prefer explicit authorship; {@link resolveHitsTravelLayers} fills defaults from role / id.
   */
  hitsTravelLayers?: InsectTravelLayer[];
}

export const PLANT_HITS_TRAVEL_LAYER_OPTIONS: ReadonlyArray<{
  id: InsectTravelLayer;
  label: string;
  hint: string;
}> = [
  { id: 'ground', label: 'Ground', hint: 'Walking insects' },
  { id: 'flying', label: 'Air', hint: 'Balloon / flying insects' },
  { id: 'burrow', label: 'Underground', hint: 'Burrowed diggers (rare)' },
];

const ALL_TRAVEL: InsectTravelLayer[] = ['ground', 'flying', 'burrow'];
const GROUND_ONLY: InsectTravelLayer[] = ['ground'];
const GROUND_AND_AIR: InsectTravelLayer[] = ['ground', 'flying'];

/** Resolve which travel layers a plant can hit (authored server list → role / id defaults). */
export function resolveHitsTravelLayers(plant: {
  id?: string;
  role?: PlantRole;
  server?: Pick<PlantServerConfig, 'hitsTravelLayers'>;
  behavior?: { kind?: string } | null;
}): InsectTravelLayer[] {
  const authored = plant.server?.hitsTravelLayers;
  if (authored && authored.length > 0) {
    const out: InsectTravelLayer[] = [];
    const seen = new Set<string>();
    for (const raw of authored) {
      const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      if (id !== 'ground' && id !== 'flying' && id !== 'burrow') continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    if (out.length > 0) return out;
  }

  const id = plant.id ?? '';
  if (id === 'spikeweed' || id === 'spikerock') return [...GROUND_ONLY];

  if (plant.role === 'anti_air') return [...GROUND_AND_AIR];

  if (
    plant.role === 'splash' ||
    plant.behavior?.kind === 'instant_explode' ||
    id === 'cherry_bomb' ||
    id === 'jalapeno' ||
    id === 'ice_shroom' ||
    id === 'doom_shroom' ||
    id === 'squash'
  ) {
    return [...ALL_TRAVEL];
  }

  return [...GROUND_ONLY];
}

/** Exported to server / API — balance + display/gfx refs for runtime catalog */
export interface ServerPlantExport {
  id: EntityId;
  displayName: string;
  description: string;
  role: PlantRole;
  rarity: PlantDefinition['rarity'];
  schemaVersion?: number;
  client: PlantClientAssets;
  behavior?: PlantBehaviorConfig;
  extraAttributes?: ExtraAttributes;
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
  schemaVersion?: number;
  client: PlantClientAssets;
  /** Combat stats needed for local sim preview in editor */
  stats: PlantStatCurve;
  behavior?: PlantBehaviorConfig;
  extraAttributes?: ExtraAttributes;
}
