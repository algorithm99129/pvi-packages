/** Default fraction of grid cell width used to size plant sprites. */
export const DEFAULT_PLANT_CELL_WIDTH_FILL = 0.8;

/** Default fraction of grid cell width used to size insect sprites. */
export const DEFAULT_INSECT_CELL_WIDTH_FILL = 0.9;

/** Default fraction of grid cell width used to size flying bullet sprites. */
export const DEFAULT_BULLET_CELL_WIDTH_FILL = 0.4;

/**
 * Normalized art box relative to one grid cell (bottom-left origin).
 * Edges are normally 0–1 inside the cell, but may overflow (e.g. −0.25…1.25)
 * so tall/wide units can extend past the cell.
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

/** Soft bounds for authored cell-anchor edges (allows overflow past the cell). */
export const UNIT_CELL_ANCHOR_EDGE_MIN = -0.75;
export const UNIT_CELL_ANCHOR_EDGE_MAX = 1.75;

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
  kind: 'plant' | 'insect',
  aspectRatio = 1,
): UnitCellAnchor {
  const defaultFill = kind === 'plant' ? DEFAULT_PLANT_CELL_WIDTH_FILL : DEFAULT_INSECT_CELL_WIDTH_FILL;
  const fallback = cellAnchorFromWidthFill(defaultFill, defaultFill, aspectRatio);
  if (client?.cellAnchor) return resolveUnitCellAnchor(client.cellAnchor, fallback);

  const fill = resolveCellWidthFill(client?.cellWidthFill, defaultFill);
  const scale = client?.scale != null && client.scale > 0 ? client.scale : 1;
  return cellAnchorFromWidthFill(fill * scale, defaultFill, aspectRatio);
}
