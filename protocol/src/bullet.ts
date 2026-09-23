import type { EntityId } from './index';
import type { PlantDefinition } from './plant';
import { primaryBulletRef } from './plant';
import { plantShootsBullets } from './plant-behavior';
import { DEFAULT_BULLET_CELL_WIDTH_FILL, resolveCellWidthFill } from './unit-sizing';

/** Single target on impact vs all enemies in a cell radius. */
export type BulletHitMode = 'single' | 'area' | 'pierce';

/** Static sprite vs Spine skeleton for a bullet status. */
export type BulletStatusKind = 'image' | 'spine';

export type BulletStatusName = 'flying';

/** How the flying sprite is oriented while the projectile moves. */
export type BulletFlyingPose = 'none' | 'tangent' | 'rotate';

export const BULLET_FLYING_POSE_OPTIONS: ReadonlyArray<{
  id: BulletFlyingPose;
  label: string;
  hint: string;
}> = [
  { id: 'none', label: 'None', hint: 'Keep the sprite upright' },
  {
    id: 'tangent',
    label: 'Tangent',
    hint: 'Sprite top stays tangent to the flight path',
  },
  { id: 'rotate', label: 'Rotate', hint: 'Spin the sprite while it flies' },
];

export interface BulletStatusPresentation {
  kind: BulletStatusKind;
  /**
   * image → ignored at resolve time; always Bullets/{folder}/flying
   * spine → animation name inside Bullets/{folder}/ skeleton
   */
  asset?: string;
}

export interface BulletVibration {
  /** Perpendicular offset from the path, in grid cells. */
  amplitude: number;
  /** Oscillation cycles per second. */
  frequency: number;
  /**
   * Random ± added to amplitude when a shot spawns.
   * Each bullet wobbles a different amount, so the path is not a fixed sine.
   */
  amplitudeDelta: number;
}

/**
 * The shot flies a limited distance, fading and shrinking along the way.
 * Used for pulses such as a sonic wave that dies out at the shooter's range.
 */
export interface BulletSpread {
  /** Travel the firing unit's range. Otherwise use distanceCells. */
  useShooterRange: boolean;
  /** Fixed travel distance in grid cells, when not using the shooter range. */
  distanceCells: number;
  /** Opacity at the end of the travel. 0 fades away, 1 stays solid. */
  endAlpha: number;
  /** Size at the end, relative to the start size. 1 stays the same. */
  endScale: number;
}

/**
 * The shot sticks to the target it hits, then detonates. It does not clip the sprite.
 * Omitted when unused.
 */
export interface BulletEmbed {
  /**
   * Legacy nose fraction. The shot no longer clips or sinks by this amount.
   * Kept so older bullets still enable sticking when a fuse is set.
   */
  length: number;
  /** Seconds after sticking before the stuck shot detonates. */
  fuseSeconds: number;
  /** Odds of stunning the target that was hit. 0 never, 1 always. */
  stunChance?: number;
}

export interface BulletBeam {
  /** Seconds the beam stays on screen before it disappears. */
  durationSeconds: number;
  /** Optional max columns the beam covers (Dewdrop). Omitted = full board edge. */
  columns?: number;
}

/**
 * Unity-drawn chain lightning (Peppercoil). Not a flying sprite —
 * combat paints arcs from the shooter through successive targets.
 */
export interface BulletChainLightning {
  /**
   * Visual palette. `red` = pepper/ember arcs; `yellow` = pale GDD default.
   */
  style: 'red' | 'yellow' | 'cyan';
  /** Delay between successive hops (seconds). */
  jumpDelaySeconds?: number;
  /** How long each arc segment stays visible (seconds). */
  arcSeconds?: number;
  /** Max insects hit (including the first). Authored on the bullet — not plant extras. */
  maxJumps?: number;
  /** Max column jump radius to the next unhit insect. */
  jumpRadiusCells?: number;
  /** When no target in range, shave this fraction of the attack interval (0–1). */
  missRefundInterval?: number;
}

/**
 * Unity-drawn flame cone (Snapdragon Ember). Not a flying sprite —
 * combat sprays fire particles in a forward cone and hits up to maxTargets.
 */
export interface BulletFlameCone {
  /**
   * Full cone aperture in degrees (e.g. 70 = ±35° from lane-forward).
   * Default 70.
   */
  angleDeg?: number;
  /** Max columns the cone reaches. Default from plant range / graph columnRange. */
  columns?: number;
  /** Burst presentation duration (seconds). Default 0.35. */
  durationSeconds?: number;
  /** Max insects hit, nearest first. Default 3. */
  maxTargets?: number;
}

export interface BulletClientAssets {
  /** PascalCase unit folder under Bullets/, e.g. Pea */
  folder: string;
  flying: BulletStatusPresentation;
  /**
   * none — sprite stays upright.
   * tangent — the top of the sprite follows the flight path.
   * rotate — sprite spins while flying.
   */
  flyingPose?: BulletFlyingPose;
  /**
   * Sideways wobble while flying. Omitted when amplitude, frequency, and delta are all zero.
   */
  vibration?: BulletVibration;
  /**
   * Limited flight that fades and shrinks. Omitted when the shot flies on with no fade.
   */
  spread?: BulletSpread;
  /**
   * The shot sticks to the target it hits and detonates after the fuse.
   * A miss explodes in place. Omitted when unused.
   */
  embed?: BulletEmbed;
  /**
   * When set, the shot is a light beam from the shooter to the edge of the screen
   * instead of a flying projectile.
   */
  beam?: BulletBeam;
  /**
   * When set, Unity draws chain-lightning arcs (no projectile flight preview).
   * Editor bullet shots UI only authors the spawn point.
   */
  chainLightning?: BulletChainLightning;
  /**
   * When set, Unity draws a flame-particle cone (no projectile flight preview).
   * Editor bullet shots UI only authors the spawn point.
   */
  flameCone?: BulletFlameCone;
  /** Fraction of grid cell width (0–1). Default 0.4. Height follows sprite aspect. */
  cellWidthFill?: number;
  /** Extra multiplier applied after cell-width fitting. */
  scale?: number;
}

export const BULLET_CHAIN_LIGHTNING_STYLE_OPTIONS: ReadonlyArray<{
  id: BulletChainLightning['style'];
  label: string;
  hint: string;
}> = [
  { id: 'red', label: 'Red (ember / pepper)', hint: 'Hot red-orange arcs' },
  { id: 'yellow', label: 'Yellow-green', hint: 'Pale electric arcs (GDD default)' },
  { id: 'cyan', label: 'Cyan', hint: 'Cool blue arcs' },
];


export interface BulletStats {
  baseDamage: number;
  damagePerLevel: number;
  /** Cells traveled per second along the shot path. */
  speed: number;
  hitMode: BulletHitMode;
  /**
   * Min fraction of this bullet's opaque (non-transparent) area that must overlap
   * the target's solid body/equipment to register a hit. Default 0.3.
   */
  hitOpaqueOverlap?: number;
  /** Area only: blast radius in grid cells around impact. */
  areaRadiusCells?: number;
  /**
   * Pierce only: max distinct targets before the shot despawns.
   * When unset and hitMode is pierce, combat defaults to 99.
   */
  pierceHits?: number;
  /**
   * Damage multipliers for successive pierce (or single) hits, 0-based.
   * e.g. `[1, 0.7, 0.45]` — missing indices reuse the last scale.
   */
  hitDamageScales?: number[];
  /**
   * Every Nth shot from the owning unit is empowered (via AdvanceAttackBeat).
   * 0 / omitted = never.
   */
  empowerEvery?: number;
  /** Extra on-hit statuses applied only when the shot is empowered. */
  empowerOnHitStatuses?: BulletOnHitStatus[];
  /**
   * When true, empower statuses only apply to Light ground insects
   * (not MaxHealth≥1500, BlocksVault, heavyUnit, or non-ground travel).
   */
  empowerLightGroundOnly?: boolean;
  /** When empowered, add this many pierce hits to pierceHits. */
  empowerExtraPierceHits?: number;
  /**
   * Combat debuffs applied to each hit target (PvZ-style chill / butter / freeze).
   * Distinct from BulletStatusPresentation (flying art).
   */
  onHitStatuses?: BulletOnHitStatus[];
  /**
   * Twinpod: second hit on the same target within pairWindowSeconds multiplies damage.
   * e.g. pairBonusScale 1.4, pairWindowSeconds 0.8.
   */
  pairBonusScale?: number;
  pairWindowSeconds?: number;
  /**
   * Tri-Berry: when the plant has a single authored shot, FireBullet expands
   * ±sideShotSpreadDeg side shots (with sideShotDamageScale, default 0.5).
   */
  sideShotSpreadDeg?: number;
  sideShotDamageScale?: number;
  /**
   * Moonseed Drowsy: N hits within sleepStackWindowSeconds apply sleep to normals,
   * or eliteSlowScale for eliteSlowSeconds on elites/heavies.
   * Authored on the bullet (not onHitStatuses); see MOONSEED_DROWSY_DEFAULTS.
   */
  sleepStacksNeeded?: number;
  sleepStackWindowSeconds?: number;
  sleepDurationSeconds?: number;
  eliteSlowScale?: number;
  eliteSlowSeconds?: number;
  /**
   * Additive damage vs flying insects (TravelLayer flying).
   * e.g. 0.25 = +25%. Does not stack multiply with lightDamageBonus — max wins.
   */
  flyerDamageBonus?: number;
  /**
   * Additive damage vs Light ground insects (not heavy/boss/knockback-immune).
   * Does not stack multiply with flyerDamageBonus — max wins.
   */
  lightDamageBonus?: number;
  /**
   * Rough Cocklebur / Velcro: shot sticks to the target for stickSeconds,
   * applying stacked slow (stickSlowScale per stack). At stickMaxStacks the
   * stuck burrs pop for stickPopDamage (defaults to baseDamage when unset).
   */
  stickSeconds?: number;
  /** Per-stack speed multiplier (0.85 = −15% each). Combined: 1 − (1−scale)×stacks. */
  stickSlowScale?: number;
  /** Max stuck burrs before pop (default 3). */
  stickMaxStacks?: number;
  /** Damage dealt when stacks reach the max and burrs disappear. */
  stickPopDamage?: number;
  /**
   * Snapdragon Warmth: N hits within warmthDurationSeconds apply burn
   * (burnDps for burnSeconds). Burn does not stack; refreshing replaces.
   */
  warmthStacksNeeded?: number;
  /** Rolling window for Warmth stacks (seconds). */
  warmthDurationSeconds?: number;
  /** Burn damage per second once Warmth reaches stacksNeeded. */
  burnDps?: number;
  /** Burn DoT duration (seconds). */
  burnSeconds?: number;
}

/** Applied by projectiles on impact — not unit status-graph statuses. */
export type BulletOnHitStatusKind = 'slow' | 'freeze' | 'stun' | 'sleep' | 'drowsy' | 'burn';

export interface BulletOnHitStatus {
  kind: BulletOnHitStatusKind;
  /** Seconds; re-applying refreshes the timer. */
  durationSeconds: number;
  /**
   * Movement multiplier while active.
   * Defaults: slow 0.5, freeze/stun 0.
   */
  speedScale?: number;
  /**
   * When true, target cannot attack / chew / fire.
   * Defaults: freeze & stun true, slow false.
   */
  blockActions?: boolean;
}

/** Common PvZ presets for the editor. */
export const BULLET_ON_HIT_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  status: BulletOnHitStatus;
}> = [
  {
    id: 'snow_pea_chill',
    label: 'Snow Pea chill',
    hint: 'Halve walk speed for 10s',
    status: { kind: 'slow', durationSeconds: 10, speedScale: 0.5, blockActions: false },
  },
  {
    id: 'ice_shroom_freeze',
    label: 'Ice freeze',
    hint: 'Stop moving and acting for 5s',
    status: { kind: 'freeze', durationSeconds: 5, speedScale: 0, blockActions: true },
  },
  {
    id: 'butter_stun',
    label: 'Butter stun',
    hint: 'Stun in place for 4s',
    status: { kind: 'stun', durationSeconds: 4, speedScale: 0, blockActions: true },
  },
];

/**
 * Moonseed-style Drowsy: stack hits on the bullet (not onHitStatuses).
 * Applied via sleepStacksNeeded / window / sleep / elite slow fields.
 */
export const MOONSEED_DROWSY_DEFAULTS = {
  sleepStacksNeeded: 4,
  sleepStackWindowSeconds: 6,
  sleepDurationSeconds: 2,
  eliteSlowScale: 0.7,
  eliteSlowSeconds: 3,
} as const;

export type MoonseedDrowsyStats = {
  sleepStacksNeeded: number;
  sleepStackWindowSeconds: number;
  sleepDurationSeconds: number;
  eliteSlowScale: number;
  eliteSlowSeconds: number;
};

export function bulletHasDrowsyStacks(
  stats: Pick<BulletStats, 'sleepStacksNeeded'> | null | undefined,
): boolean {
  return (stats?.sleepStacksNeeded ?? 0) > 0;
}

export function applyMoonseedDrowsyDefaults(): Partial<BulletStats> {
  return { ...MOONSEED_DROWSY_DEFAULTS };
}

export function clearMoonseedDrowsyStats(): Partial<BulletStats> {
  return {
    sleepStacksNeeded: undefined,
    sleepStackWindowSeconds: undefined,
    sleepDurationSeconds: undefined,
    eliteSlowScale: undefined,
    eliteSlowSeconds: undefined,
  };
}

/**
 * Velcro Vine Rough Cocklebur: stick, stack slow, pop at max stacks.
 */
export const VELCRO_COCKLEBUR_DEFAULTS = {
  stickSeconds: 2,
  stickSlowScale: 0.85,
  stickMaxStacks: 3,
  stickPopDamage: 24,
} as const;

export type VelcroCockleburStats = {
  stickSeconds: number;
  stickSlowScale: number;
  stickMaxStacks: number;
  stickPopDamage: number;
};

export function bulletHasCockleburStick(
  stats: Pick<BulletStats, 'stickMaxStacks' | 'stickSeconds'> | null | undefined,
): boolean {
  return (stats?.stickMaxStacks ?? 0) > 0 && (stats?.stickSeconds ?? 0) > 0;
}

export function applyVelcroCockleburDefaults(): Partial<BulletStats> {
  return { ...VELCRO_COCKLEBUR_DEFAULTS, baseDamage: 0, damagePerLevel: 0 };
}

export function clearVelcroCockleburStats(): Partial<BulletStats> {
  return {
    stickSeconds: undefined,
    stickSlowScale: undefined,
    stickMaxStacks: undefined,
    stickPopDamage: undefined,
  };
}

/**
 * Acorn Blaster–style: every Nth shot applies empowerOnHitStatuses
 * (brief butter stun on light ground by default).
 */
export const ACORN_EMPOWER_DEFAULTS = {
  empowerEvery: 5,
  empowerLightGroundOnly: true,
  empowerOnHitStatuses: [
    {
      kind: 'stun' as const,
      durationSeconds: 0.35,
      speedScale: 0,
      blockActions: true,
    },
  ],
};

export function bulletHasEmpowerShot(
  stats: Pick<BulletStats, 'empowerEvery'> | null | undefined,
): boolean {
  return (stats?.empowerEvery ?? 0) > 0;
}

export function applyAcornEmpowerDefaults(): Partial<BulletStats> {
  return {
    empowerEvery: ACORN_EMPOWER_DEFAULTS.empowerEvery,
    empowerLightGroundOnly: ACORN_EMPOWER_DEFAULTS.empowerLightGroundOnly,
    empowerOnHitStatuses: ACORN_EMPOWER_DEFAULTS.empowerOnHitStatuses.map((s) => ({ ...s })),
  };
}

export function clearEmpowerShotStats(): Partial<BulletStats> {
  return {
    empowerEvery: undefined,
    empowerOnHitStatuses: undefined,
    empowerLightGroundOnly: undefined,
    empowerExtraPierceHits: undefined,
  };
}

export function defaultOnHitSpeedScale(kind: BulletOnHitStatusKind): number {
  if (kind === 'slow' || kind === 'drowsy') return 0.5;
  return 0;
}

export function defaultOnHitBlockActions(kind: BulletOnHitStatusKind): boolean {
  return kind === 'freeze' || kind === 'stun' || kind === 'sleep';
}

export interface BulletDefinition {
  id: EntityId;
  displayName: string;
  description?: string;
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
  client: BulletClientAssets;
  stats: BulletStats;
}

/** Same payload for client Resources and API — presentation + combat. */
export type ClientBulletExport = BulletDefinition;
export type ServerBulletExport = BulletDefinition;

/** True when combat uses a Unity-drawn presentation instead of a flying sprite. */
export function bulletUsesUnityPresentation(
  bullet: Pick<BulletDefinition, 'client'> | null | undefined,
): boolean {
  if (!bullet?.client) return false;
  if (bullet.client.beam && bullet.client.beam.durationSeconds > 0) return true;
  if (bullet.client.chainLightning) return true;
  if (bullet.client.flameCone) return true;
  return false;
}

/**
 * Snapdragon-style Warmth → burn. Authored on the bullet (not onHitStatuses).
 */
export const SNAPDRAGON_WARMTH_DEFAULTS = {
  warmthStacksNeeded: 3,
  warmthDurationSeconds: 4,
  burnDps: 8,
  burnSeconds: 4,
} as const;

export type SnapdragonWarmthStats = {
  warmthStacksNeeded: number;
  warmthDurationSeconds: number;
  burnDps: number;
  burnSeconds: number;
};

export function bulletHasWarmthStacks(
  stats: Pick<BulletStats, 'warmthStacksNeeded'> | null | undefined,
): boolean {
  return (stats?.warmthStacksNeeded ?? 0) > 0;
}

export function applySnapdragonWarmthDefaults(): Partial<BulletStats> {
  return { ...SNAPDRAGON_WARMTH_DEFAULTS };
}

export function clearSnapdragonWarmthStats(): Partial<BulletStats> {
  return {
    warmthStacksNeeded: undefined,
    warmthDurationSeconds: undefined,
    burnDps: undefined,
    burnSeconds: undefined,
  };
}

/** Editor hint: only author spawn UVs; flight path is owned by Unity. */
export function bulletPreviewIsSpawnOnly(
  bullet: Pick<BulletDefinition, 'client'> | null | undefined,
): boolean {
  return bulletUsesUnityPresentation(bullet);
}

export const DEFAULT_BULLET_AREA_RADIUS_CELLS = 1;
export const DEFAULT_BULLET_SPEED = 3.5;
export const DEFAULT_BULLET_DAMAGE_PER_LEVEL = 2;
/** Min opaque-area overlap with the target to count as a hit. */
export const DEFAULT_BULLET_HIT_OPAQUE_OVERLAP = 0.3;

/** Fixed image basename for each status under Bullets/{folder}/. */
export function bulletStatusImageName(status: BulletStatusName): string {
  return status;
}

/** Resources path without extension: Bullets/{folder}/flying */
export function bulletStatusImagePath(folder: string, status: BulletStatusName): string {
  return `Bullets/${folder}/${bulletStatusImageName(status)}`;
}

/** @deprecated Use bulletStatusImagePath(folder, 'flying') */
export function defaultFlyingImagePath(folder: string): string {
  return bulletStatusImagePath(folder, 'flying');
}

export function defaultBulletClientAssets(folder: string): BulletClientAssets {
  return {
    folder,
    flying: { kind: 'image' },
    cellWidthFill: DEFAULT_BULLET_CELL_WIDTH_FILL,
    scale: 1,
  };
}

export function defaultBulletStats(): BulletStats {
  return {
    baseDamage: 20,
    damagePerLevel: DEFAULT_BULLET_DAMAGE_PER_LEVEL,
    speed: DEFAULT_BULLET_SPEED,
    hitMode: 'single',
    hitOpaqueOverlap: DEFAULT_BULLET_HIT_OPAQUE_OVERLAP,
  };
}

/** Resolved presentation: image path or spine anim name under the bullet folder. */
export function resolveBulletStatusAsset(
  client: Pick<BulletClientAssets, 'folder'>,
  status: BulletStatusName,
  presentation: BulletStatusPresentation | undefined,
): { kind: BulletStatusKind; asset: string } | undefined {
  if (!presentation) return undefined;
  const kind: BulletStatusKind = presentation.kind === 'spine' ? 'spine' : 'image';
  if (kind === 'image') {
    return { kind: 'image', asset: bulletStatusImagePath(client.folder, status) };
  }
  const asset =
    typeof presentation.asset === 'string' && presentation.asset.length > 0
      ? presentation.asset
      : client.folder;
  return { kind: 'spine', asset };
}

/** Create a new combat bullet with sensible defaults. */
export function createBulletDefinition(
  partial?: Omit<Partial<BulletDefinition>, 'client' | 'stats'> & {
    folder?: string;
    client?: Partial<BulletClientAssets> & LegacyBulletClientFields;
    stats?: Partial<BulletStats>;
  },
): BulletDefinition {
  const folder =
    partial?.client?.folder ??
    partial?.folder ??
    (partial?.displayName ? toPascal(partial.displayName) : 'Pea');
  const id = partial?.id && partial.id.length > 0 ? partial.id : toSnake(folder);
  const client = normalizeBulletClient(
    (partial?.client ?? { ...defaultBulletClientAssets(folder) }) as Partial<BulletClientAssets> &
      LegacyBulletClientFields,
    folder,
  );
  const stats = normalizeBulletStats(partial?.stats);
  return {
    id,
    displayName: partial?.displayName ?? folder,
    description: partial?.description,
    client,
    stats,
  };
}

/**
 * Normalize legacy attribute / bullets.json rows
 * (`{ id, folder, displayName, idle }` or flat animKind/frames) into a full BulletDefinition.
 */
export function normalizeBulletDefinition(raw: unknown): BulletDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;

  const nestedClient =
    row.client && typeof row.client === 'object' ? (row.client as Record<string, unknown>) : null;
  let folder =
    (typeof nestedClient?.folder === 'string' && nestedClient.folder) ||
    (typeof row.folder === 'string' && row.folder) ||
    toPascal(id);
  // Legacy rename: PeaNormal → Pea
  if (folder === 'PeaNormal') folder = 'Pea';

  const statsRaw =
    row.stats && typeof row.stats === 'object' ? (row.stats as Partial<BulletStats>) : undefined;

  const resolvedId = id === 'pea_normal' ? 'pea' : id;

  return createBulletDefinition({
    id: resolvedId,
    displayName:
      typeof row.displayName === 'string'
        ? row.displayName === 'PeaNormal'
          ? 'Pea'
          : row.displayName
        : folder,
    description: typeof row.description === 'string' ? row.description : undefined,
    client: {
      folder,
      ...(nestedClient ?? {
        flying:
          typeof row.idle === 'string'
            ? row.idle
            : typeof row.flying === 'string'
              ? row.flying
              : undefined,
      }),
    } as Partial<BulletClientAssets> & LegacyBulletClientFields,
    stats: statsRaw,
  });
}

/** Match plant.client.bullet (folder or id) to a combat bullet definition. */
export function resolveBulletByRef(
  bullets: BulletDefinition[],
  ref: string | undefined | null,
): BulletDefinition | undefined {
  if (!ref) return undefined;
  const normalized = ref === 'PeaNormal' || ref === 'pea_normal' ? 'Pea' : ref;
  const exact = bullets.find((b) => b.client.folder === normalized || b.id === normalized);
  if (exact) return exact;
  const lower = normalized.toLowerCase();
  return bullets.find(
    (b) => b.client.folder.toLowerCase() === lower || b.id.toLowerCase() === lower,
  );
}

/**
 * Damage curve inputs for catalog / player resolve.
 * Shooters inherit from the primary (highest-weight) bullet; other plants use plant stats.
 */
export function resolvePlantDamageCurveInputs(
  plant: Pick<PlantDefinition, 'id' | 'role' | 'client' | 'behavior' | 'stats'>,
  bullets: BulletDefinition[],
): { base: number; perLevel: number } {
  if (plantShootsBullets(plant)) {
    const bullet = resolveBulletByRef(bullets, primaryBulletRef(plant.client));
    if (bullet) {
      return {
        base: bullet.stats.baseDamage,
        perLevel: bullet.stats.damagePerLevel,
      };
    }
  }
  return {
    base: plant.stats.baseDamage,
    perLevel: plant.stats.levelScaling.damagePerLevel,
  };
}

export function resolvePlantDamageBase(
  plant: Pick<PlantDefinition, 'id' | 'role' | 'client' | 'behavior' | 'stats'>,
  bullets: BulletDefinition[],
): number {
  return resolvePlantDamageCurveInputs(plant, bullets).base;
}

/** @deprecated Always the primary bullet folder. */
export function bulletStatusUnitFolder(
  client: BulletClientAssets,
  _status: BulletStatusName,
): string {
  return client.folder;
}

/** @deprecated Legacy flat client fields accepted only during normalize. */
type LegacyBulletClientFields = {
  animLayout?: string;
  animKind?: string;
  explodeAnimKind?: string;
  explodeFlying?: string;
  explodeFolder?: string;
  /** Legacy flat string flying (clip / idle name). */
  flying?: string | BulletStatusPresentation;
  /** Ignored — hit FX moved to runtime Cartoon FX. */
  explode?: string | BulletStatusPresentation;
};

function normalizeBulletClient(
  client: Partial<BulletClientAssets> & LegacyBulletClientFields,
  fallbackFolder: string,
): BulletClientAssets {
  let folder = client.folder && client.folder.length > 0 ? client.folder : fallbackFolder;
  if (folder === 'PeaNormal') folder = 'Pea';

  const flying = normalizeStatusPresentation(client.flying, {
    status: 'flying',
    folder,
    legacyKind: client.animKind,
  });

  const next: BulletClientAssets = { folder, flying };
  next.flyingPose = normalizeFlyingPose(client.flyingPose);
  const vibration = normalizeVibration(client.vibration);
  if (vibration) next.vibration = vibration;
  const spread = normalizeSpread(client.spread);
  if (spread) next.spread = spread;
  const embed = normalizeEmbed(client.embed);
  if (embed) next.embed = embed;
  const beam = normalizeBeam(client.beam);
  if (beam) next.beam = beam;
  const chain = normalizeChainLightning(client.chainLightning);
  if (chain) next.chainLightning = chain;
  const flame = normalizeFlameCone(client.flameCone);
  if (flame) next.flameCone = flame;
  next.cellWidthFill = resolveCellWidthFill(client.cellWidthFill, DEFAULT_BULLET_CELL_WIDTH_FILL);
  const scale =
    client.scale != null && Number.isFinite(client.scale) && client.scale > 0 ? client.scale : 1;
  next.scale = scale;
  return next;
}

function normalizeFlyingPose(value: unknown): BulletFlyingPose {
  if (value === 'tangent' || value === 'rotate' || value === 'none') return value;
  return 'none';
}

function normalizeVibration(value: unknown): BulletVibration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletVibration>;
  const amplitude = finiteNonNegative(raw.amplitude);
  const frequency = finiteNonNegative(raw.frequency);
  const amplitudeDelta = finiteNonNegative(raw.amplitudeDelta);
  if (amplitude <= 0 && frequency <= 0 && amplitudeDelta <= 0) return undefined;
  return { amplitude, frequency, amplitudeDelta };
}

function normalizeSpread(value: unknown): BulletSpread | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletSpread>;
  const distanceCells = finiteNonNegative(raw.distanceCells);
  const endAlpha = clamp01(raw.endAlpha, 1);
  const endScale = clamp01(raw.endScale, 1);
  const fades = endAlpha < 0.999 || endScale < 0.999;
  const useShooterRange = raw.useShooterRange === true || (distanceCells <= 0 && fades);
  if (!useShooterRange && distanceCells <= 0) return undefined;
  return { useShooterRange, distanceCells, endAlpha, endScale };
}

function normalizeEmbed(value: unknown): BulletEmbed | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletEmbed>;
  const length = clamp01(raw.length, 0);
  const fuseSeconds = finiteNonNegative(raw.fuseSeconds);
  if (fuseSeconds <= 0) return undefined;
  const stunChance = clamp01(raw.stunChance, 0);
  const embed: BulletEmbed = { length, fuseSeconds };
  if (stunChance > 0) embed.stunChance = stunChance;
  return embed;
}

function normalizeBeam(value: unknown): BulletBeam | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletBeam>;
  const durationSeconds = finiteNonNegative(raw.durationSeconds);
  if (durationSeconds <= 0) return undefined;
  const out: BulletBeam = { durationSeconds };
  const columns = finiteNonNegative(raw.columns);
  if (columns > 0) out.columns = columns;
  return out;
}

function normalizeChainLightning(value: unknown): BulletChainLightning | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletChainLightning>;
  const styleRaw = typeof raw.style === 'string' ? raw.style.trim().toLowerCase() : 'red';
  const style: BulletChainLightning['style'] =
    styleRaw === 'yellow' || styleRaw === 'cyan' || styleRaw === 'red' ? styleRaw : 'red';
  const jumpDelaySeconds = finiteNonNegative(raw.jumpDelaySeconds);
  const arcSeconds = finiteNonNegative(raw.arcSeconds);
  const maxJumps = finiteNonNegative(raw.maxJumps);
  const jumpRadiusCells = finiteNonNegative(raw.jumpRadiusCells);
  const missRefundInterval = finiteNonNegative(raw.missRefundInterval);
  const out: BulletChainLightning = { style };
  if (jumpDelaySeconds > 0) out.jumpDelaySeconds = jumpDelaySeconds;
  if (arcSeconds > 0) out.arcSeconds = arcSeconds;
  if (maxJumps > 0) out.maxJumps = Math.max(1, Math.round(maxJumps));
  if (jumpRadiusCells > 0) out.jumpRadiusCells = jumpRadiusCells;
  if (missRefundInterval > 0) out.missRefundInterval = Math.min(1, missRefundInterval);
  return out;
}

function normalizeFlameCone(value: unknown): BulletFlameCone | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<BulletFlameCone>;
  const angleDeg = finiteNonNegative(raw.angleDeg);
  const columns = finiteNonNegative(raw.columns);
  const durationSeconds = finiteNonNegative(raw.durationSeconds);
  const maxTargets = finiteNonNegative(raw.maxTargets);
  // Presence of the object opts into flame-cone presentation; Unity fills defaults.
  const out: BulletFlameCone = {};
  if (angleDeg > 0) out.angleDeg = Math.min(180, angleDeg);
  if (columns > 0) out.columns = columns;
  if (durationSeconds > 0) out.durationSeconds = durationSeconds;
  if (maxTargets > 0) out.maxTargets = Math.max(1, Math.round(maxTargets));
  return out;
}

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function finiteNonNegative(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function normalizeStatusPresentation(
  value: string | BulletStatusPresentation | undefined,
  opts: {
    status: BulletStatusName;
    folder: string;
    legacyKind?: string;
  },
): BulletStatusPresentation {
  if (value && typeof value === 'object' && 'kind' in value) {
    const kind: BulletStatusKind = value.kind === 'spine' ? 'spine' : 'image';
    if (kind === 'image') return { kind: 'image' };
    const asset =
      typeof value.asset === 'string' && value.asset.length > 0 ? value.asset : opts.folder;
    return { kind: 'spine', asset };
  }

  const kind = legacyKindToStatus(opts.legacyKind);
  if (kind === 'image') return { kind: 'image' };
  if (typeof value === 'string' && value.length > 0 && !value.includes('/')) {
    return { kind: 'spine', asset: value };
  }
  return { kind: 'spine', asset: opts.folder };
}

function legacyKindToStatus(kind?: string): BulletStatusKind {
  if (kind === 'spine') return 'spine';
  return 'image';
}

function normalizeBulletStats(stats?: Partial<BulletStats>): BulletStats {
  const hitMode: BulletHitMode =
    stats?.hitMode === 'area' || stats?.hitMode === 'pierce' ? stats.hitMode : 'single';
  const next: BulletStats = {
    baseDamage: Number.isFinite(stats?.baseDamage) ? Math.max(0, stats!.baseDamage!) : 20,
    damagePerLevel: Number.isFinite(stats?.damagePerLevel)
      ? Math.max(0, stats!.damagePerLevel!)
      : DEFAULT_BULLET_DAMAGE_PER_LEVEL,
    speed: Number.isFinite(stats?.speed) ? Math.max(0.1, stats!.speed!) : DEFAULT_BULLET_SPEED,
    hitMode,
    hitOpaqueOverlap: clamp01(stats?.hitOpaqueOverlap, DEFAULT_BULLET_HIT_OPAQUE_OVERLAP),
  };
  if (hitMode === 'area') {
    next.areaRadiusCells =
      Number.isFinite(stats?.areaRadiusCells) && (stats!.areaRadiusCells as number) > 0
        ? (stats!.areaRadiusCells as number)
        : DEFAULT_BULLET_AREA_RADIUS_CELLS;
  }
  if (hitMode === 'pierce') {
    const pierce =
      Number.isFinite(stats?.pierceHits) && (stats!.pierceHits as number) > 0
        ? Math.max(1, Math.round(stats!.pierceHits as number))
        : undefined;
    if (pierce != null) next.pierceHits = pierce;
  }
  const scales = normalizeHitDamageScales(stats?.hitDamageScales);
  if (scales) next.hitDamageScales = scales;
  const empowerEvery =
    Number.isFinite(stats?.empowerEvery) && (stats!.empowerEvery as number) > 0
      ? Math.max(1, Math.round(stats!.empowerEvery as number))
      : 0;
  if (empowerEvery > 0) next.empowerEvery = empowerEvery;
  const empowerOnHit = normalizeOnHitStatuses(stats?.empowerOnHitStatuses);
  if (empowerOnHit) next.empowerOnHitStatuses = empowerOnHit;
  if (stats?.empowerLightGroundOnly === true) next.empowerLightGroundOnly = true;
  const extraPierce =
    Number.isFinite(stats?.empowerExtraPierceHits) && (stats!.empowerExtraPierceHits as number) > 0
      ? Math.max(1, Math.round(stats!.empowerExtraPierceHits as number))
      : 0;
  if (extraPierce > 0) next.empowerExtraPierceHits = extraPierce;
  const onHit = normalizeOnHitStatuses(stats?.onHitStatuses);
  if (onHit) next.onHitStatuses = onHit;

  const pairBonus = finiteNonNegative(stats?.pairBonusScale);
  if (pairBonus > 1) next.pairBonusScale = pairBonus;
  const pairWindow = finiteNonNegative(stats?.pairWindowSeconds);
  if (pairWindow > 0) next.pairWindowSeconds = pairWindow;

  const sideSpread = finiteNonNegative(stats?.sideShotSpreadDeg);
  if (sideSpread > 0) next.sideShotSpreadDeg = sideSpread;
  const sideDmg = finiteNonNegative(stats?.sideShotDamageScale);
  if (sideDmg > 0) next.sideShotDamageScale = sideDmg;

  const sleepNeed =
    Number.isFinite(stats?.sleepStacksNeeded) && (stats!.sleepStacksNeeded as number) > 0
      ? Math.max(1, Math.round(stats!.sleepStacksNeeded as number))
      : 0;
  if (sleepNeed > 0) next.sleepStacksNeeded = sleepNeed;
  const sleepWindow = finiteNonNegative(stats?.sleepStackWindowSeconds);
  if (sleepWindow > 0) next.sleepStackWindowSeconds = sleepWindow;
  const sleepDur = finiteNonNegative(stats?.sleepDurationSeconds);
  if (sleepDur > 0) next.sleepDurationSeconds = sleepDur;
  const eliteSlow = finiteNonNegative(stats?.eliteSlowScale);
  if (eliteSlow > 0) next.eliteSlowScale = eliteSlow;
  const eliteSlowSec = finiteNonNegative(stats?.eliteSlowSeconds);
  if (eliteSlowSec > 0) next.eliteSlowSeconds = eliteSlowSec;

  const flyerBonus = finiteNonNegative(stats?.flyerDamageBonus);
  if (flyerBonus > 0) next.flyerDamageBonus = flyerBonus;
  const lightBonus = finiteNonNegative(stats?.lightDamageBonus);
  if (lightBonus > 0) next.lightDamageBonus = lightBonus;

  const stickMax =
    Number.isFinite(stats?.stickMaxStacks) && (stats!.stickMaxStacks as number) > 0
      ? Math.max(1, Math.round(stats!.stickMaxStacks as number))
      : 0;
  const stickSec = finiteNonNegative(stats?.stickSeconds);
  if (stickMax > 0 && stickSec > 0) {
    next.stickMaxStacks = stickMax;
    next.stickSeconds = stickSec;
    const slow = finiteNonNegative(stats?.stickSlowScale);
    next.stickSlowScale =
      slow > 0 && slow <= 1 ? slow : VELCRO_COCKLEBUR_DEFAULTS.stickSlowScale;
    const pop = finiteNonNegative(stats?.stickPopDamage);
    if (pop > 0) next.stickPopDamage = pop;
  }

  const warmthNeed =
    Number.isFinite(stats?.warmthStacksNeeded) && (stats!.warmthStacksNeeded as number) > 0
      ? Math.max(1, Math.round(stats!.warmthStacksNeeded as number))
      : 0;
  if (warmthNeed > 0) {
    next.warmthStacksNeeded = warmthNeed;
    const warmthWindow = finiteNonNegative(stats?.warmthDurationSeconds);
    next.warmthDurationSeconds =
      warmthWindow > 0 ? warmthWindow : SNAPDRAGON_WARMTH_DEFAULTS.warmthDurationSeconds;
    const dps = finiteNonNegative(stats?.burnDps);
    next.burnDps = dps > 0 ? dps : SNAPDRAGON_WARMTH_DEFAULTS.burnDps;
    const burnSec = finiteNonNegative(stats?.burnSeconds);
    next.burnSeconds = burnSec > 0 ? burnSec : SNAPDRAGON_WARMTH_DEFAULTS.burnSeconds;
  }

  return next;
}

function normalizeHitDamageScales(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: number[] = [];
  for (const item of raw) {
    const n = typeof item === 'number' ? item : Number(item);
    if (!Number.isFinite(n) || n < 0) continue;
    out.push(n);
  }
  return out.length > 0 ? out : undefined;
}

function normalizeOnHitStatuses(raw: unknown): BulletOnHitStatus[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: BulletOnHitStatus[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const kind =
      row.kind === 'slow' ||
      row.kind === 'freeze' ||
      row.kind === 'stun' ||
      row.kind === 'sleep' ||
      row.kind === 'drowsy' ||
      row.kind === 'burn'
        ? row.kind
        : null;
    if (!kind) continue;
    const duration = Number(row.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const status: BulletOnHitStatus = {
      kind,
      durationSeconds: duration,
    };
    if (row.speedScale !== undefined && Number.isFinite(Number(row.speedScale))) {
      status.speedScale = Math.max(0, Math.min(1, Number(row.speedScale)));
    }
    if (typeof row.blockActions === 'boolean') status.blockActions = row.blockActions;
    out.push(status);
  }
  return out.length > 0 ? out : undefined;
}

function toPascal(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}
