import type { EntityId } from './index';
import type { PlantDefinition } from './plant';
import { plantShootsBullets } from './plant-behavior';

/** Single target on impact vs all enemies in a cell radius. */
export type BulletHitMode = 'single' | 'area';

/** Static sprite vs Spine skeleton for a bullet status. */
export type BulletStatusKind = 'image' | 'spine';

export interface BulletStatusPresentation {
  kind: BulletStatusKind;
  /**
   * image → Resources path without extension, e.g. Bullets/PeaNormal/flying
   * spine → animation name inside that status’s unit folder skeleton
   */
  asset: string;
}

export interface BulletClientAssets {
  /** PascalCase unit folder under Bullets/, e.g. PeaNormal */
  folder: string;
  flying: BulletStatusPresentation;
  explode?: BulletStatusPresentation;
  /** When explode art lives in another Bullets/ unit (legacy PeaNormalExplode). */
  explodeFolder?: string;
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

export function defaultFlyingImagePath(folder: string): string {
  return `Bullets/${folder}/flying`;
}

export function defaultExplodeImagePath(folder: string): string {
  return `Bullets/${folder}/explode`;
}

export function defaultBulletClientAssets(folder: string): BulletClientAssets {
  return {
    folder,
    flying: { kind: 'image', asset: defaultFlyingImagePath(folder) },
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
    client?: Partial<BulletClientAssets> & LegacyBulletClientFields;
    stats?: Partial<BulletStats>;
  },
): BulletDefinition {
  const folder =
    partial?.client?.folder ??
    partial?.folder ??
    (partial?.displayName ? toPascal(partial.displayName) : 'PeaNormal');
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
  const folder =
    (typeof nestedClient?.folder === 'string' && nestedClient.folder) ||
    (typeof row.folder === 'string' && row.folder) ||
    toPascal(id);

  const statsRaw =
    row.stats && typeof row.stats === 'object' ? (row.stats as Partial<BulletStats>) : undefined;

  return createBulletDefinition({
    id,
    displayName: typeof row.displayName === 'string' ? row.displayName : folder,
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

/** Unit folder used for a status (explode may live in explodeFolder). */
export function bulletStatusUnitFolder(
  client: BulletClientAssets,
  status: 'flying' | 'explode',
): string {
  if (status === 'explode' && client.explodeFolder) return client.explodeFolder;
  return client.folder;
}

/** @deprecated Legacy flat client fields accepted only during normalize. */
type LegacyBulletClientFields = {
  animLayout?: string;
  animKind?: string;
  explodeAnimKind?: string;
  explodeFlying?: string;
  /** Legacy flat string flying (clip / idle name). */
  flying?: string | BulletStatusPresentation;
  explode?: string | BulletStatusPresentation;
};

function normalizeBulletClient(
  client: Partial<BulletClientAssets> & LegacyBulletClientFields,
  fallbackFolder: string,
): BulletClientAssets {
  const folder = client.folder && client.folder.length > 0 ? client.folder : fallbackFolder;
  const explodeFolder =
    typeof client.explodeFolder === 'string' && client.explodeFolder.length > 0
      ? client.explodeFolder
      : client.animLayout === 'split'
        ? `${folder}Explode`
        : undefined;

  const flying = normalizeStatusPresentation(client.flying, {
    legacyKind: client.animKind,
    imageDefault: defaultFlyingImagePath(folder),
    spineFallbackName: folder,
  });

  const explodeRaw =
    client.explode ??
    (typeof client.explodeFlying === 'string' ? client.explodeFlying : undefined);
  const explodeUnit = explodeFolder ?? folder;
  const explode =
    explodeRaw !== undefined
      ? normalizeStatusPresentation(explodeRaw, {
          legacyKind: client.explodeAnimKind ?? client.animKind,
          imageDefault: defaultExplodeImagePath(explodeUnit),
          spineFallbackName: typeof explodeRaw === 'string' ? explodeRaw : explodeUnit,
        })
      : client.animLayout === 'split' || explodeFolder
        ? {
            kind: legacyKindToStatus(client.explodeAnimKind ?? client.animKind),
            asset:
              legacyKindToStatus(client.explodeAnimKind ?? client.animKind) === 'spine'
                ? (typeof client.explodeFlying === 'string' && client.explodeFlying) || explodeUnit
                : defaultExplodeImagePath(explodeUnit),
          }
        : undefined;

  const next: BulletClientAssets = { folder, flying };
  if (explode) next.explode = explode;
  if (explodeFolder) next.explodeFolder = explodeFolder;
  return next;
}

function normalizeStatusPresentation(
  value: string | BulletStatusPresentation | undefined,
  opts: {
    legacyKind?: string;
    imageDefault: string;
    spineFallbackName: string;
  },
): BulletStatusPresentation {
  if (value && typeof value === 'object' && 'kind' in value && 'asset' in value) {
    const kind: BulletStatusKind = value.kind === 'spine' ? 'spine' : 'image';
    const asset =
      typeof value.asset === 'string' && value.asset.length > 0
        ? value.asset
        : kind === 'spine'
          ? opts.spineFallbackName
          : opts.imageDefault;
    return { kind, asset };
  }

  const kind = legacyKindToStatus(opts.legacyKind);
  if (typeof value === 'string' && value.length > 0) {
    if (kind === 'spine') return { kind: 'spine', asset: value };
    // Legacy frames clip name → conventional image path (not the clip folder name).
    if (value.includes('/')) return { kind: 'image', asset: value };
    return { kind: 'image', asset: opts.imageDefault };
  }

  return {
    kind,
    asset: kind === 'spine' ? opts.spineFallbackName : opts.imageDefault,
  };
}

function legacyKindToStatus(kind?: string): BulletStatusKind {
  if (kind === 'spine') return 'spine';
  // frames | image | missing → image
  return 'image';
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
