import type { EntityId } from './index';
import type { PlantDefinition } from './plant';
import { plantShootsBullets } from './plant-behavior';
import { DEFAULT_BULLET_CELL_WIDTH_FILL, resolveCellWidthFill } from './unit-sizing';

/** Single target on impact vs all enemies in a cell radius. */
export type BulletHitMode = 'single' | 'area';

/** Static sprite vs Spine skeleton for a bullet status. */
export type BulletStatusKind = 'image' | 'spine';

export type BulletStatusName = 'flying';

export interface BulletStatusPresentation {
  kind: BulletStatusKind;
  /**
   * image → ignored at resolve time; always Bullets/{folder}/flying
   * spine → animation name inside Bullets/{folder}/ skeleton
   */
  asset?: string;
}

export interface BulletClientAssets {
  /** PascalCase unit folder under Bullets/, e.g. Pea */
  folder: string;
  flying: BulletStatusPresentation;
  /** Fraction of grid cell width (0–1). Default 0.4. Height follows sprite aspect. */
  cellWidthFill?: number;
  /** Extra multiplier applied after cell-width fitting. */
  scale?: number;
}

export interface BulletStats {
  baseDamage: number;
  damagePerLevel: number;
  /** Cells traveled per second along the shot path. */
  speed: number;
  hitMode: BulletHitMode;
  /** Area only: blast radius in grid cells around impact. */
  areaRadiusCells?: number;
  /**
   * Combat debuffs applied to each hit target (PvZ-style chill / butter / freeze).
   * Distinct from BulletStatusPresentation (flying art).
   */
  onHitStatuses?: BulletOnHitStatus[];
}

/** Applied by projectiles on impact — not unit status-graph statuses. */
export type BulletOnHitStatusKind = 'slow' | 'freeze' | 'stun';

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

export function defaultOnHitSpeedScale(kind: BulletOnHitStatusKind): number {
  if (kind === 'slow') return 0.5;
  return 0;
}

export function defaultOnHitBlockActions(kind: BulletOnHitStatusKind): boolean {
  return kind === 'freeze' || kind === 'stun';
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

export const DEFAULT_BULLET_AREA_RADIUS_CELLS = 1;
export const DEFAULT_BULLET_SPEED = 3.5;
export const DEFAULT_BULLET_DAMAGE_PER_LEVEL = 2;

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
  next.cellWidthFill = resolveCellWidthFill(client.cellWidthFill, DEFAULT_BULLET_CELL_WIDTH_FILL);
  const scale =
    client.scale != null && Number.isFinite(client.scale) && client.scale > 0 ? client.scale : 1;
  next.scale = scale;
  return next;
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
  const onHit = normalizeOnHitStatuses(stats?.onHitStatuses);
  if (onHit) next.onHitStatuses = onHit;
  return next;
}

function normalizeOnHitStatuses(raw: unknown): BulletOnHitStatus[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: BulletOnHitStatus[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const kind =
      row.kind === 'slow' || row.kind === 'freeze' || row.kind === 'stun' ? row.kind : null;
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
