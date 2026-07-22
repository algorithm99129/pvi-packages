/** Default fraction of grid cell width used to size plant sprites. */
export const DEFAULT_PLANT_CELL_WIDTH_FILL = 0.8;

/** Default fraction of grid cell width used to size insect sprites. */
export const DEFAULT_INSECT_CELL_WIDTH_FILL = 0.9;

/** Default fraction of grid cell width used to size flying bullet sprites. */
export const DEFAULT_BULLET_CELL_WIDTH_FILL = 0.4;

/** Normalized art box inside one grid cell (0–1, bottom-left origin). */
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

/** Clamp an authored cell-width fill ratio; falls back when missing or invalid. */
export function resolveCellWidthFill(value: number | undefined, defaultFill: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return defaultFill;
  return Math.min(1, Math.max(0.05, value));
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
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

/** Sanitize / clamp a cell anchor; falls back when missing or invalid. */
export function resolveUnitCellAnchor(
  value: UnitCellAnchor | undefined,
  fallback: UnitCellAnchor,
): UnitCellAnchor {
  if (!value) return { ...fallback };
  let minX = clamp01(value.minX, fallback.minX);
  let minY = clamp01(value.minY, fallback.minY);
  let maxX = clamp01(value.maxX, fallback.maxX);
  let maxY = clamp01(value.maxY, fallback.maxY);
  if (maxX - minX < 0.05) {
    const mid = (minX + maxX) / 2;
    minX = Math.max(0, mid - 0.025);
    maxX = Math.min(1, mid + 0.025);
  }
  if (maxY - minY < 0.05) {
    const mid = (minY + maxY) / 2;
    minY = Math.max(0, mid - 0.025);
    maxY = Math.min(1, mid + 0.025);
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
