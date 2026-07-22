import type { EntityId } from './index';
import type { InsectGraphStatus } from './entity-state-graph';
import { INSECT_GRAPH_STATUSES } from './entity-state-graph';

/** Local AABB relative to insect root, in cell-width fractions. */
export interface EquipmentHitbox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface EquipmentClientAssets {
  /** PascalCase folder under Equipment/, e.g. IronHelmet */
  folder: string;
  /**
   * Default placement template when an insect first assigns this piece.
   * Runtime uses `insect.client.equipmentHitbox` when set (per-insect).
   */
  hitbox: EquipmentHitbox;
  /** Optional overlay sprite Resources path without extension. */
  image?: string;
  /** Reserved for Magnet-shroom / steal_metal. */
  isMetal?: boolean;
}

export interface EquipmentStats {
  health: number;
}

export interface EquipmentDefinition {
  id: EntityId;
  displayName: string;
  description?: string;
  schemaVersion?: number;
  stats: EquipmentStats;
  /**
   * Insect status-graph status to enter when equipment HP hits 0.
   * Empty / omitted = none (still sets ArmorBroken).
   */
  onDestroyStatus?: InsectGraphStatus | '';
  client: EquipmentClientAssets;
}

/** Same payload for client Resources and API. */
export type ClientEquipmentExport = EquipmentDefinition;
export type ServerEquipmentExport = EquipmentDefinition;

export const DEFAULT_EQUIPMENT_HEALTH = 200;

export const DEFAULT_EQUIPMENT_HITBOX: EquipmentHitbox = {
  offsetX: 0.15,
  offsetY: 0.35,
  width: 0.55,
  height: 0.55,
};

/** Statuses selectable as on-destroy features (die is body-only). */
export const EQUIPMENT_ON_DESTROY_STATUSES: ReadonlyArray<{
  id: InsectGraphStatus | '';
  label: string;
}> = [
  { id: '', label: 'None' },
  ...INSECT_GRAPH_STATUSES.filter((s) => s.id !== 'die').map((s) => ({
    id: s.id as InsectGraphStatus,
    label: s.label,
  })),
];

export function equipmentAvatarPath(folder: string): string {
  return `Equipment/${folder}/avatar`;
}

export function defaultEquipmentClientAssets(folder: string): EquipmentClientAssets {
  return {
    folder,
    hitbox: { ...DEFAULT_EQUIPMENT_HITBOX },
    image: equipmentAvatarPath(folder),
    isMetal: false,
  };
}

export function defaultEquipmentStats(health = DEFAULT_EQUIPMENT_HEALTH): EquipmentStats {
  return { health };
}

function toPascal(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toSnake(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function normalizeEquipmentHitbox(
  hitbox: Partial<EquipmentHitbox> | undefined,
): EquipmentHitbox {
  const base = DEFAULT_EQUIPMENT_HITBOX;
  return {
    offsetX: Number.isFinite(hitbox?.offsetX) ? Number(hitbox!.offsetX) : base.offsetX,
    offsetY: Number.isFinite(hitbox?.offsetY) ? Number(hitbox!.offsetY) : base.offsetY,
    width: Math.max(0.05, Number.isFinite(hitbox?.width) ? Number(hitbox!.width) : base.width),
    height: Math.max(0.05, Number.isFinite(hitbox?.height) ? Number(hitbox!.height) : base.height),
  };
}

export function normalizeEquipmentDefinition(
  raw: Partial<EquipmentDefinition> & { folder?: string } | null | undefined,
): EquipmentDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const folder =
    raw.client?.folder?.trim() ||
    raw.folder?.trim() ||
    (raw.displayName ? toPascal(raw.displayName) : '') ||
    (raw.id ? toPascal(raw.id) : '');
  if (!folder) return null;
  const id = raw.id?.trim() || toSnake(folder);
  if (!id) return null;

  const onDestroy =
    raw.onDestroyStatus === '' || raw.onDestroyStatus == null
      ? ''
      : (String(raw.onDestroyStatus) as InsectGraphStatus | '');

  return {
    id,
    displayName: raw.displayName?.trim() || folder,
    description: raw.description?.trim() || undefined,
    schemaVersion: raw.schemaVersion,
    stats: {
      health: Math.max(
        1,
        Number.isFinite(raw.stats?.health) ? Number(raw.stats!.health) : DEFAULT_EQUIPMENT_HEALTH,
      ),
    },
    onDestroyStatus: onDestroy,
    client: {
      folder,
      hitbox: normalizeEquipmentHitbox(raw.client?.hitbox),
      image:
        typeof raw.client?.image === 'string' && raw.client.image.trim()
          ? raw.client.image.replace(/\\/g, '/').replace(/\.[^./]+$/, '')
          : equipmentAvatarPath(folder),
      isMetal: Boolean(raw.client?.isMetal),
    },
  };
}

export function createEquipmentDefinition(
  partial?: Omit<Partial<EquipmentDefinition>, 'client' | 'stats'> & {
    folder?: string;
    client?: Partial<EquipmentClientAssets>;
    stats?: Partial<EquipmentStats>;
  },
): EquipmentDefinition {
  const folder =
    partial?.client?.folder ??
    partial?.folder ??
    (partial?.displayName ? toPascal(partial.displayName) : 'IronHelmet');
  const id = partial?.id && partial.id.length > 0 ? partial.id : toSnake(folder);
  return normalizeEquipmentDefinition({
    ...partial,
    id,
    displayName: partial?.displayName ?? folder,
    client: {
      ...defaultEquipmentClientAssets(folder),
      ...partial?.client,
      folder,
    },
    stats: {
      ...defaultEquipmentStats(),
      ...partial?.stats,
    },
  })!;
}
