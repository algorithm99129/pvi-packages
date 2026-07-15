import type { EntityId } from './index';
import type { PlantDefinition } from './plant';
import { plantShootsBullets } from './plant-behavior';

/** Single target on impact vs all enemies in a cell radius. */
export type BulletHitMode = 'single' | 'area';

/**
 * shared — flying + explode clips live on the primary bullet unit
 * split — explode uses a separate Bullets/ folder (legacy PeaNormalExplode)
 */
export type BulletAnimLayout = 'shared' | 'split';

/** Image frame flipbook vs Spine skeleton at the unit root. */
export type BulletAnimKind = 'frames' | 'spine';

export interface BulletClientAssets {
  /** PascalCase unit folder under Bullets/, e.g. PeaNormal */
  folder: string;
  animLayout: BulletAnimLayout;
  /**
   * Primary unit presentation backend.
   * frames = sprites/animations/{clip}/; spine = skeleton.json + atlas + texture.
   * Defaults to frames for back-compat.
   */
  animKind?: BulletAnimKind;
  /**
   * Split layout only: explode unit backend. Omit → same as animKind.
   */
  explodeAnimKind?: BulletAnimKind;
  /**
   * frames: clip folder under sprites/animations/
   * spine: animation name inside skeleton.json
   */
  flying: string;
  /** Shared layout: explode clip/anim on the primary unit. */
  explode?: string;
  /** Split layout: separate explode unit folder. */
  explodeFolder?: string;
  /** Split layout: clip/anim name inside explodeFolder. */
  explodeFlying?: string;
}

export interface BulletStats {
  baseDamage: number;
  damagePerLevel: number;
  /** Cells traveled per second along the shot path. */
  speed: number;
  hitMode: BulletHitMode;
  /** Area only: blast radius in grid cells around impact. */
  areaRadiusCells?: number;
}

export interface BulletDefinition {
  id: EntityId;
  displayName: string;
  description?: string;
  client: BulletClientAssets;
  stats: BulletStats;
}

/** Same payload for client Resources and API — presentation + combat. */
export type ClientBulletExport = BulletDefinition;
export type ServerBulletExport = BulletDefinition;

export const DEFAULT_BULLET_AREA_RADIUS_CELLS = 1;
export const DEFAULT_BULLET_SPEED = 3.5;
export const DEFAULT_BULLET_DAMAGE_PER_LEVEL = 2;

export function defaultBulletClientAssets(folder: string): BulletClientAssets {
  return {
    folder,
    animLayout: 'shared',
    animKind: 'frames',
    flying: folder,
  };
}

export function defaultBulletStats(): BulletStats {
  return {
    baseDamage: 20,
    damagePerLevel: DEFAULT_BULLET_DAMAGE_PER_LEVEL,
    speed: DEFAULT_BULLET_SPEED,
    hitMode: 'single',
  };
}

/** Create a new combat bullet with sensible defaults. */
export function createBulletDefinition(
  partial?: Omit<Partial<BulletDefinition>, 'client' | 'stats'> & {
    folder?: string;
    client?: Partial<BulletClientAssets>;
    stats?: Partial<BulletStats>;
  },
): BulletDefinition {
  const folder =
    partial?.client?.folder ??
    partial?.folder ??
    (partial?.displayName ? toPascal(partial.displayName) : 'PeaNormal');
  const id = partial?.id && partial.id.length > 0 ? partial.id : toSnake(folder);
  const client = normalizeBulletClient(partial?.client ?? { ...defaultBulletClientAssets(folder) }, folder);
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
 * (`{ id, folder, displayName, idle }`) into a full BulletDefinition.
 */
export function normalizeBulletDefinition(raw: unknown): BulletDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;

  const nestedClient =
    row.client && typeof row.client === 'object' ? (row.client as Record<string, unknown>) : null;
  const folder =
    (typeof nestedClient?.folder === 'string' && nestedClient.folder) ||
    (typeof row.folder === 'string' && row.folder) ||
    toPascal(id);
  const legacyIdle =
    (typeof nestedClient?.flying === 'string' && nestedClient.flying) ||
    (typeof nestedClient?.idle === 'string' && nestedClient.idle) ||
    (typeof row.idle === 'string' && row.idle) ||
    folder;

  const clientPartial: Partial<BulletClientAssets> = nestedClient
    ? {
        folder,
        animLayout: nestedClient.animLayout === 'split' ? 'split' : 'shared',
        animKind: nestedClient.animKind === 'spine' ? 'spine' : 'frames',
        explodeAnimKind:
          nestedClient.explodeAnimKind === 'spine'
            ? 'spine'
            : nestedClient.explodeAnimKind === 'frames'
              ? 'frames'
              : undefined,
        flying: typeof nestedClient.flying === 'string' ? nestedClient.flying : legacyIdle,
        explode: typeof nestedClient.explode === 'string' ? nestedClient.explode : undefined,
        explodeFolder:
          typeof nestedClient.explodeFolder === 'string' ? nestedClient.explodeFolder : undefined,
        explodeFlying:
          typeof nestedClient.explodeFlying === 'string' ? nestedClient.explodeFlying : undefined,
      }
    : {
        folder,
        animLayout: 'shared',
        animKind: 'frames',
        flying: legacyIdle,
      };

  const statsRaw =
    row.stats && typeof row.stats === 'object' ? (row.stats as Partial<BulletStats>) : undefined;

  return createBulletDefinition({
    id,
    displayName: typeof row.displayName === 'string' ? row.displayName : folder,
    description: typeof row.description === 'string' ? row.description : undefined,
    client: clientPartial as BulletClientAssets,
    stats: statsRaw,
  });
}

/** Match plant.client.bullet (folder or id) to a combat bullet definition. */
export function resolveBulletByRef(
  bullets: BulletDefinition[],
  ref: string | undefined | null,
): BulletDefinition | undefined {
  if (!ref) return undefined;
  const exact = bullets.find((b) => b.client.folder === ref || b.id === ref);
  if (exact) return exact;
  const lower = ref.toLowerCase();
  return bullets.find(
    (b) => b.client.folder.toLowerCase() === lower || b.id.toLowerCase() === lower,
  );
}

/**
 * Damage curve inputs for catalog / player resolve.
 * Shooters inherit from the referenced bullet; other plants use plant stats.
 */
export function resolvePlantDamageCurveInputs(
  plant: Pick<PlantDefinition, 'id' | 'role' | 'client' | 'behavior' | 'stats'>,
  bullets: BulletDefinition[],
): { base: number; perLevel: number } {
  if (plantShootsBullets(plant)) {
    const bullet = resolveBulletByRef(bullets, plant.client.bullet);
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

function normalizeBulletClient(
  client: Partial<BulletClientAssets>,
  fallbackFolder: string,
): BulletClientAssets {
  const folder = client.folder && client.folder.length > 0 ? client.folder : fallbackFolder;
  const animLayout: BulletAnimLayout = client.animLayout === 'split' ? 'split' : 'shared';
  const animKind: BulletAnimKind = client.animKind === 'spine' ? 'spine' : 'frames';
  const flying = client.flying && client.flying.length > 0 ? client.flying : folder;
  const next: BulletClientAssets = { folder, animLayout, animKind, flying };
  if (animLayout === 'shared') {
    if (client.explode) next.explode = client.explode;
  } else {
    if (client.explodeFolder) next.explodeFolder = client.explodeFolder;
    if (client.explodeFlying) next.explodeFlying = client.explodeFlying;
    else if (client.explode) next.explodeFlying = client.explode;
    if (client.explodeAnimKind === 'spine' || client.explodeAnimKind === 'frames') {
      next.explodeAnimKind = client.explodeAnimKind;
    }
  }
  return next;
}

function normalizeBulletStats(stats?: Partial<BulletStats>): BulletStats {
  const hitMode: BulletHitMode = stats?.hitMode === 'area' ? 'area' : 'single';
  const next: BulletStats = {
    baseDamage: Number.isFinite(stats?.baseDamage) ? Math.max(0, stats!.baseDamage!) : 20,
    damagePerLevel: Number.isFinite(stats?.damagePerLevel)
      ? Math.max(0, stats!.damagePerLevel!)
      : DEFAULT_BULLET_DAMAGE_PER_LEVEL,
    speed: Number.isFinite(stats?.speed) ? Math.max(0.1, stats!.speed!) : DEFAULT_BULLET_SPEED,
    hitMode,
  };
  if (hitMode === 'area') {
    next.areaRadiusCells =
      Number.isFinite(stats?.areaRadiusCells) && (stats!.areaRadiusCells as number) > 0
        ? (stats!.areaRadiusCells as number)
        : DEFAULT_BULLET_AREA_RADIUS_CELLS;
  }
  return next;
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
