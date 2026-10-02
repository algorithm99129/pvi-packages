/**
 * Timing stats that improve with unit level, shared by plants and insects.
 *
 * Health and damage grow linearly (`healthPerLevel` / `damagePerLevel`). The two timing
 * stats ease toward a floor instead, so an upgrade never makes a unit fire or redeploy
 * infinitely fast:
 *
 *   value(L) = base × (1 − t × (1 − minScale)),  t = (L − 1) / (maxLevel − 1)
 *
 * A missing, non-positive or ≥ 1 minScale means "does not scale".
 */

function levelT(level: number, maxLevel: number): number {
  const top = Math.max(2, Math.floor(maxLevel) || 2);
  const lv = Math.max(1, Math.floor(level) || 1);
  return Math.min(1, Math.max(0, (lv - 1) / (top - 1)));
}

function usableMinScale(minScale: number | undefined | null): minScale is number {
  return minScale != null && Number.isFinite(minScale) && minScale > 0 && minScale < 0.999;
}

/** Milliseconds between attacks at a level. Never below 50 ms. */
export function scaleAttackIntervalMs(
  baseMs: number,
  minScale: number | undefined | null,
  level: number,
  maxLevel: number,
): number {
  if (!(baseMs > 0) || !usableMinScale(minScale)) return baseMs;
  const scale = 1 - levelT(level, maxLevel) * (1 - minScale);
  return Math.max(50, Math.round(baseMs * scale));
}

/**
 * Move speed (cells per second) at a level. Unlike the two timings above this one rises,
 * easing from the authored speed at level 1 to maxScale × that speed at max level.
 */
export function scaleMoveSpeed(
  baseSpeed: number,
  maxScale: number | undefined | null,
  level: number,
  maxLevel: number,
): number {
  if (!(baseSpeed > 0) || maxScale == null || !Number.isFinite(maxScale) || maxScale <= 1.001) {
    return baseSpeed;
  }
  const speed = baseSpeed * (1 + levelT(level, maxLevel) * (maxScale - 1));
  return Math.round(speed * 1000) / 1000;
}

/** Card recharge ("refresh") seconds at a level, to one decimal. Never below 0.5 s. */
export function scaleRechargeSeconds(
  baseSeconds: number,
  minScale: number | undefined | null,
  level: number,
  maxLevel: number,
): number {
  if (!(baseSeconds > 0) || !usableMinScale(minScale)) return baseSeconds;
  const scale = 1 - levelT(level, maxLevel) * (1 - minScale);
  return Math.max(0.5, Math.round(baseSeconds * scale * 10) / 10);
}
