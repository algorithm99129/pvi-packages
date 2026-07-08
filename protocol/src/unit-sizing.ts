/** Default fraction of grid cell width used to size plant sprites. */
export const DEFAULT_PLANT_CELL_WIDTH_FILL = 0.8;

/** Default fraction of grid cell width used to size insect sprites. */
export const DEFAULT_INSECT_CELL_WIDTH_FILL = 0.9;

/** Clamp an authored cell-width fill ratio; falls back when missing or invalid. */
export function resolveCellWidthFill(value: number | undefined, defaultFill: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return defaultFill;
  return Math.min(1, Math.max(0.1, value));
}
