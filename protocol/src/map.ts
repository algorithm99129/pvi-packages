export type MapCellType = 'ground' | 'water' | 'bridge' | 'pot';

export const MAP_CELL_TYPES: MapCellType[] = ['ground', 'water', 'bridge', 'pot'];

export const DEFAULT_MAP_GRID_COLUMNS = 9;

export interface MapLaneConfig {
  laneIndex: number;
  /**
   * Valid cell columns on this lane (0 .. columnCount-1).
   * Mesh width is still {@link MapTemplateDefinition.gridColumns} (= max across lanes).
   */
  columnCount?: number;
  /** @deprecated Use per-cell `gridLayout.cellTypes` */
  terrain?: MapCellType;
  /** @deprecated Use {@link columnCount} */
  plantColumns?: number;
}

/** Per-grid-cell terrain / surface type. Omitted cells default to `ground`. */
export interface MapGridCellType {
  lane: number;
  column: number;
  type: MapCellType;
}

/** @deprecated Legacy cell-center anchors — migrated to `corners` on load */
export interface MapGridCellAnchor {
  lane: number;
  column: number;
  x: number;
  y: number;
}

/** Grid mesh intersection for closed per-lane quads (see {@link laneTopRow}). */
export interface MapGridCorner {
  row: number;
  col: number;
  x: number;
  y: number;
}

/** Per-lane seed (PVZ brain) — lane is lost if insects reach it. */
/** @deprecated Not authored in the map editor; Unity uses default mower anchors. */
export interface MapLaneSeedAnchor {
  lane: number;
  x: number;
  y: number;
}

/** Normalized rectangle on the map background (0–1, y down from top). */
export interface NormalizedMapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lane grid authored in normalized coordinates (0–1) relative to the map background image.
 * `referenceWidth` × `referenceHeight` must match the background image pixel size.
 * Each lane is a **closed** quad mesh: top edge row = {@link laneTopRow}, bottom = {@link laneBottomRow}.
 * Adjacent lanes do **not** share corners — drag them apart freely in the editor.
 * Optional `insectsArea` is the sidewalk / preview strip to the right of the grid.
 * Plant/insect *column* bands for combat are still defined on missions / game rules.
 */
export interface MapGridLayout {
  /** Background image width in pixels — all normalized X coords are relative to this. */
  referenceWidth: number;
  /** Background image height in pixels — all normalized Y coords are relative to this. */
  referenceHeight: number;
  corners: MapGridCorner[];
  /** @deprecated Not authored in the map editor */
  seeds?: MapLaneSeedAnchor[];
  /** Per-cell surface type (ground, water, bridge). Missing cells = ground. */
  cellTypes?: MapGridCellType[];
  /** @deprecated Migrated to `corners` */
  cells?: MapGridCellAnchor[];
  /**
   * Optional sidewalk / insect preview region (normalized).
   * Used for in-raid seed-select camera focus and idle insect display.
   */
  insectsArea?: NormalizedMapRect;
}

/** Village / story map template */
export interface MapTemplateDefinition {
  id: string;
  displayName: string;
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
  tier: number;
  laneCount: number;
  /**
   * Mesh column count (= max {@link MapLaneConfig.columnCount} across lanes).
   * Each lane is an independent closed grid; corner cols = gridColumns + 1 on the longest lane.
   */
  gridColumns: number;
  lanes: MapLaneConfig[];
  /** Client background / tileset — paths relative to Assets/Resources */
  client: {
    backgroundImage: string;
    /**
     * Square list / shop thumbnail (target {@link MAP_THUMBNAIL_SIZE}).
     * Default convention: {@link mapThumbnailPath}.
     */
    thumbnailImage?: string;
    /** Background variant index (0=day, 1=night, …) */
    backgroundType?: number;
    /**
     * Explicit day/night for combat. When omitted, night is inferred from
     * `backgroundType >= 1` or id/background path containing "night".
     */
    timeOfDay?: 'day' | 'night';
    /**
     * On night maps, multiply attack range of day-affinity plants by this.
     * Omit or 1 = no penalty. Example: 0.75 → day shooters lose 25% range at night.
     */
    dayAffinityNightRangeScale?: number;
    tileset?: string;
    parallaxLayers?: string[];
    /** Optional per-cell anchors aligned to the background art */
    gridLayout?: MapGridLayout;
  };
  /** Server topology only */
  server: {
    corePosition: { lane: number; column: number };
    maxVillageLevel: number;
    minVillageLevel: number;
    /** Garden map shop coin price (0 = free once unlocked by village level). */
    shopPriceCoin?: number;
    /** Garden map shop gem price. */
    shopPriceGem?: number;
  };
}

export interface ServerMapExport {
  id: string;
  schemaVersion?: number;
  tier: number;
  laneCount: number;
  gridColumns: number;
  lanes: MapLaneConfig[];
  server: MapTemplateDefinition['server'];
}

export interface ClientMapExport {
  id: string;
  displayName: string;
  schemaVersion?: number;
  tier: number;
  laneCount: number;
  gridColumns: number;
  lanes: MapLaneConfig[];
  corePosition: MapTemplateDefinition['server']['corePosition'];
  client: MapTemplateDefinition['client'];
}

/** Default Resources-relative path (no extension) for the square map list thumbnail. */
export function mapThumbnailPath(mapId: string): string {
  const id = String(mapId ?? '').trim();
  return id ? `Maps/${id}/thumbnail` : 'Maps/thumbnail';
}

/** Authored pixel size for map list / shop thumbnails. */
export const MAP_THUMBNAIL_SIZE = { width: 256, height: 256 } as const;

/** Top edge corner row for an independent closed lane. */
export function laneTopRow(lane: number): number {
  return Math.max(0, lane | 0) * 2;
}

/** Bottom edge corner row for an independent closed lane. */
export function laneBottomRow(lane: number): number {
  return Math.max(0, lane | 0) * 2 + 1;
}

/** Corner row count for closed-lane meshes (`0 .. 2*laneCount-1`). */
export function closedLaneCornerRowCount(laneCount: number): number {
  return Math.max(0, laneCount | 0) * 2;
}

/** Lane index that owns a closed-lane corner row. */
export function laneIndexFromCornerRow(row: number): number {
  return Math.floor(Math.max(0, row | 0) / 2);
}

/** Max corner `row` across the mesh (-1 if empty). */
export function maxCornerRow(corners: Array<{ row: number }> | undefined): number {
  if (!corners?.length) return -1;
  let max = -1;
  for (const corner of corners) {
    if (corner == null || !Number.isFinite(corner.row)) continue;
    max = Math.max(max, corner.row);
  }
  return max;
}

/**
 * Legacy shared-edge mesh uses rows `0..laneCount` (bottom of L = top of L+1).
 * Closed-lane mesh uses rows `0..2*laneCount-1`.
 */
export function isSharedEdgeCornerMesh(
  corners: Array<{ row: number }> | undefined,
  laneCount: number,
): boolean {
  const lanes = Math.max(0, laneCount | 0);
  if (lanes < 1) return false;
  const maxRow = maxCornerRow(corners);
  return maxRow === lanes;
}

/**
 * Duplicate each shared boundary into independent top/bottom edges.
 * Positions start coincident so maps look the same until edited apart.
 */
export function migrateSharedCornersToClosedLanes(
  corners: MapGridCorner[] | undefined,
  laneCount: number,
  gridColumns: number,
): MapGridCorner[] {
  const lanes = Math.max(0, laneCount | 0);
  const cols = Math.max(1, gridColumns | 0);
  const byKey = new Map<string, MapGridCorner>();
  for (const corner of corners ?? []) {
    if (corner == null || !Number.isFinite(corner.row) || !Number.isFinite(corner.col)) continue;
    byKey.set(`${corner.row}:${corner.col}`, corner);
  }

  const result: MapGridCorner[] = [];
  for (let lane = 0; lane < lanes; lane += 1) {
    const oldTop = lane;
    const oldBottom = lane + 1;
    const topRow = laneTopRow(lane);
    const bottomRow = laneBottomRow(lane);
    for (let col = 0; col <= cols; col += 1) {
      const top = byKey.get(`${oldTop}:${col}`);
      const bottom = byKey.get(`${oldBottom}:${col}`);
      result.push({
        row: topRow,
        col,
        x: top?.x ?? 0,
        y: top?.y ?? 0,
      });
      result.push({
        row: bottomRow,
        col,
        x: bottom?.x ?? 0,
        y: bottom?.y ?? 0,
      });
    }
  }
  return result;
}

/** Valid cell columns for one lane (falls back to map mesh width). */
export function laneColumnCount(
  map: Pick<MapTemplateDefinition, 'gridColumns' | 'lanes'>,
  laneIndex: number,
): number {
  const fallback = Math.max(1, map.gridColumns || DEFAULT_MAP_GRID_COLUMNS);
  const lane = map.lanes?.find((entry) => entry.laneIndex === laneIndex);
  if (!lane) return fallback;
  const raw = lane.columnCount ?? lane.plantColumns;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.max(1, Math.floor(raw));
}

/** Mesh width = max per-lane column count (and legacy gridColumns). */
export function recomputeGridColumns(
  map: Pick<MapTemplateDefinition, 'gridColumns' | 'laneCount' | 'lanes'>,
): number {
  const laneCount = Math.max(0, map.laneCount | 0);
  let max = Math.max(0, map.gridColumns | 0);
  for (let i = 0; i < laneCount; i += 1) {
    max = Math.max(max, laneColumnCount(map, i));
  }
  return Math.max(1, max || DEFAULT_MAP_GRID_COLUMNS);
}

export function isValidMapCell(
  map: Pick<MapTemplateDefinition, 'gridColumns' | 'laneCount' | 'lanes'>,
  lane: number,
  column: number,
): boolean {
  if (lane < 0 || column < 0) return false;
  if (lane >= Math.max(0, map.laneCount | 0)) return false;
  return column < laneColumnCount(map, lane);
}

/** Normalize lane list: ensure length, migrate plantColumns → columnCount. */
export function normalizeMapLanes(
  map: Pick<MapTemplateDefinition, 'gridColumns' | 'laneCount' | 'lanes'>,
): MapLaneConfig[] {
  const mesh = Math.max(1, map.gridColumns || DEFAULT_MAP_GRID_COLUMNS);
  const laneCount = Math.max(0, map.laneCount | 0);
  const byIndex = new Map<number, MapLaneConfig>();
  for (const lane of map.lanes ?? []) {
    if (lane == null || !Number.isFinite(lane.laneIndex)) continue;
    byIndex.set(lane.laneIndex, lane);
  }
  return Array.from({ length: laneCount }, (_, index) => {
    const prev = byIndex.get(index);
    const raw = prev?.columnCount ?? prev?.plantColumns ?? mesh;
    const columnCount = Math.max(1, Math.floor(Number(raw) || mesh));
    return {
      laneIndex: index,
      columnCount,
    };
  });
}
