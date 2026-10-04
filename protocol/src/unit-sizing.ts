/** Default fraction of grid cell width used to size plant sprites. */
export const DEFAULT_PLANT_CELL_WIDTH_FILL = 0.8;

/** Default fraction of grid cell width used to size insect sprites. */
export const DEFAULT_INSECT_CELL_WIDTH_FILL = 0.9;

/** Default fraction of grid cell width used to size flying bullet sprites. */
export const DEFAULT_BULLET_CELL_WIDTH_FILL = 0.4;

/** Default fraction of grid cell width used to size dirty egg group sprites. */
export const DEFAULT_EGG_GROUP_CELL_WIDTH_FILL = 0.82;

/**
 * Normalized art box relative to the placement space (bottom-left origin):
 * one lawn cell, or the whole footprint when `server.footprintColumns` /
 * `footprintLanes` are greater than 1.
 * Edges are normally 0–1 inside that space, but may overflow (e.g. −0.25…1.25).
 * Combat and the editor use the same UV: size = placementWorld × (max−min),
 * feet at (midX, minY) on the placement quad.
 */
export interface UnitCellAnchor {
  /** Left edge as a fraction of cell width. */
  minX: number;
  /** Bottom edge as a fraction of cell height. */
  minY: number;
  /** Right edge as a fraction of cell width. */
  maxX: number;
  /** Top edge as a fraction of cell height. */
  maxY: number;
}

/**
 * A hole rimmed with soil at a unit's base (pieces of Resources/Screen/GroundEdgePattern laid
 * along an ellipse), authored in Studio's cell placement section. Same space as
 * {@link UnitCellAnchor}: fractions of the placement cell (or footprint), bottom-left origin.
 * The far half of the rim is drawn behind the unit and the near half in front of it. Units
 * that burrow get a hole at their dig line without this; it is for plants that should look
 * rooted in the lawn.
 */
export interface UnitGroundEdge {
  enabled: boolean;
  /** Centre of the ellipse, 0 = left edge of the cell, 1 = right edge. */
  x: number;
  /** Centre of the ellipse (the groundline), 0 = bottom edge of the cell, 1 = top edge. */
  y: number;
  /** Width of the ellipse as a fraction of the cell (placement box) width. */
  width: number;
  /** Height of the ellipse as a fraction of the cell (placement box) height. */
  height: number;
  /** Which arrangement of soil pieces ("Shuffle" in Studio). */
  seed: number;
}

export const UNIT_GROUND_EDGE_WIDTH_MIN = 0.1;
export const UNIT_GROUND_EDGE_WIDTH_MAX = 3;
export const UNIT_GROUND_EDGE_HEIGHT_MIN = 0.02;
export const UNIT_GROUND_EDGE_HEIGHT_MAX = 2;
/**
 * Default height of the hole per unit of width, both as cell fractions. A cell is about 1.5×
 * wider than tall, so 0.45 draws an ellipse roughly 3.3 times wider than it is high — a round
 * hole seen at the lawn's angle.
 */
export const UNIT_GROUND_EDGE_HEIGHT_PER_WIDTH = 0.45;

/** The hole a unit gets when the option is first switched on: around the base of its art. */
export function defaultUnitGroundEdge(anchor: UnitCellAnchor): UnitGroundEdge {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const width = Math.min(
    UNIT_GROUND_EDGE_WIDTH_MAX,
    Math.max(UNIT_GROUND_EDGE_WIDTH_MIN, (anchor.maxX - anchor.minX) * 0.8),
  );
  return {
    enabled: true,
    x: round((anchor.minX + anchor.maxX) / 2),
    y: round(anchor.minY),
    width: round(width),
    height: round(width * UNIT_GROUND_EDGE_HEIGHT_PER_WIDTH),
    seed: 1,
  };
}

/** Fill in what older data lacks (height, seed) so every reader sees the full shape. */
export function resolveUnitGroundEdge(edge: Partial<UnitGroundEdge> & { enabled: boolean }): UnitGroundEdge {
  const width = Number.isFinite(edge.width) ? (edge.width as number) : 1;
  return {
    enabled: edge.enabled,
    x: Number.isFinite(edge.x) ? (edge.x as number) : 0.5,
    y: Number.isFinite(edge.y) ? (edge.y as number) : 0,
    width,
    height: Number.isFinite(edge.height) ? (edge.height as number) : width * UNIT_GROUND_EDGE_HEIGHT_PER_WIDTH,
    seed: Number.isFinite(edge.seed) ? Math.trunc(edge.seed as number) : 0,
  };
}

/** Soft bounds for authored cell-anchor edges (allows overflow past the cell). */
export const UNIT_CELL_ANCHOR_EDGE_MIN = -1.5;
export const UNIT_CELL_ANCHOR_EDGE_MAX = 2.5;

/** Soft max for cell-width fill (may exceed 1 when the art overflows the cell). */
export const UNIT_CELL_WIDTH_FILL_MAX = 2.5;

/** Clamp an authored cell-width fill ratio; falls back when missing or invalid. */
export function resolveCellWidthFill(value: number | undefined, defaultFill: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return defaultFill;
  return Math.min(UNIT_CELL_WIDTH_FILL_MAX, Math.max(0.05, value));
}

function clampEdge(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(UNIT_CELL_ANCHOR_EDGE_MAX, Math.max(UNIT_CELL_ANCHOR_EDGE_MIN, value));
}

/** Build a bottom-centered cell anchor from a legacy width-fill ratio. */
export function cellAnchorFromWidthFill(
  fill: number | undefined,
  defaultFill: number,
  aspectRatio = 1,
): UnitCellAnchor {
  const width = resolveCellWidthFill(fill, defaultFill);
  const safeAspect = aspectRatio > 0.05 ? aspectRatio : 1;
  // Square cell: height fraction = width / (imgW/imgH) = width * imgH/imgW = width / aspect
  let height = width / safeAspect;
  if (height > 1) {
    const scale = 1 / height;
    return {
      minX: (1 - width * scale) / 2,
      minY: 0,
      maxX: (1 + width * scale) / 2,
      maxY: 1,
    };
  }
  return {
    minX: (1 - width) / 2,
    minY: 0,
    maxX: (1 + width) / 2,
    maxY: height,
  };
}

export function defaultPlantCellAnchor(aspectRatio = 1): UnitCellAnchor {
  return cellAnchorFromWidthFill(DEFAULT_PLANT_CELL_WIDTH_FILL, DEFAULT_PLANT_CELL_WIDTH_FILL, aspectRatio);
}

export function defaultInsectCellAnchor(aspectRatio = 1): UnitCellAnchor {
  return cellAnchorFromWidthFill(
    DEFAULT_INSECT_CELL_WIDTH_FILL,
    DEFAULT_INSECT_CELL_WIDTH_FILL,
    aspectRatio,
  );
}

export function defaultEggGroupCellAnchor(aspectRatio = 1): UnitCellAnchor {
  return cellAnchorFromWidthFill(
    DEFAULT_EGG_GROUP_CELL_WIDTH_FILL,
    DEFAULT_EGG_GROUP_CELL_WIDTH_FILL,
    aspectRatio,
  );
}

/** Sanitize a cell anchor (soft edge bounds; overflow past 0–1 is allowed). */
export function resolveUnitCellAnchor(
  value: UnitCellAnchor | undefined,
  fallback: UnitCellAnchor,
): UnitCellAnchor {
  if (!value) return { ...fallback };
  let minX = clampEdge(value.minX, fallback.minX);
  let minY = clampEdge(value.minY, fallback.minY);
  let maxX = clampEdge(value.maxX, fallback.maxX);
  let maxY = clampEdge(value.maxY, fallback.maxY);
  if (maxX - minX < 0.05) {
    const mid = (minX + maxX) / 2;
    minX = clampEdge(mid - 0.025, mid - 0.025);
    maxX = clampEdge(mid + 0.025, mid + 0.025);
  }
  if (maxY - minY < 0.05) {
    const mid = (minY + maxY) / 2;
    minY = clampEdge(mid - 0.025, mid - 0.025);
    maxY = clampEdge(mid + 0.025, mid + 0.025);
  }
  if (maxX < minX) [minX, maxX] = [maxX, minX];
  if (maxY < minY) [minY, maxY] = [maxY, minY];
  return { minX, minY, maxX, maxY };
}

export function unitCellAnchorWidth(anchor: UnitCellAnchor): number {
  return Math.max(0.05, anchor.maxX - anchor.minX);
}

export function unitCellAnchorHeight(anchor: UnitCellAnchor): number {
  return Math.max(0.05, anchor.maxY - anchor.minY);
}

/**
 * Resolve plant/insect cell placement.
 * Prefers authored `cellAnchor`; otherwise migrates from legacy `cellWidthFill` (+ scale).
 */
export function resolveClientCellAnchor(
  client: { cellAnchor?: UnitCellAnchor; cellWidthFill?: number; scale?: number } | undefined,
  kind: 'plant' | 'insect' | 'special',
  aspectRatio = 1,
): UnitCellAnchor {
  const defaultFill =
    kind === 'plant'
      ? DEFAULT_PLANT_CELL_WIDTH_FILL
      : kind === 'insect'
        ? DEFAULT_INSECT_CELL_WIDTH_FILL
        : DEFAULT_EGG_GROUP_CELL_WIDTH_FILL;
  const fallback = cellAnchorFromWidthFill(defaultFill, defaultFill, aspectRatio);
  if (client?.cellAnchor) return resolveUnitCellAnchor(client.cellAnchor, fallback);

  const fill = resolveCellWidthFill(client?.cellWidthFill, defaultFill);
  const scale = client?.scale != null && client.scale > 0 ? client.scale : 1;
  return cellAnchorFromWidthFill(fill * scale, defaultFill, aspectRatio);
}
