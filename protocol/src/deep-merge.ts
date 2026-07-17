/** Deep-merge helpers that preserve authored data across client/server merges. */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Merge two values preferring `primary` when both exist.
 * - Scalars: primary wins when defined
 * - Arrays: primary wins when non-empty; otherwise fallback
 * - Objects: recursive key union; missing keys filled from fallback
 *
 * Use for presentation blobs (`client`, nested configs) so newer editor/client
 * authoring is kept while older server-only fields still fill gaps.
 */
export function mergePreferPrimary<T>(primary: T | undefined, fallback: T | undefined): T | undefined {
  if (primary === undefined || primary === null) return fallback;
  if (fallback === undefined || fallback === null) return primary;

  if (Array.isArray(primary)) {
    return (primary.length > 0 ? primary : fallback) as T;
  }

  if (isPlainObject(primary) && isPlainObject(fallback)) {
    const keys = new Set([...Object.keys(primary), ...Object.keys(fallback)]);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const p = primary[key];
      const f = fallback[key];
      if (p === undefined) out[key] = f;
      else if (f === undefined) out[key] = p;
      else out[key] = mergePreferPrimary(p, f);
    }
    return out as T;
  }

  return primary;
}

/** True when `value` looks like richer presentation than `other` (has graph / shots). */
export function clientPresentationScore(client: unknown): number {
  if (!isPlainObject(client)) return 0;
  let score = 0;
  if (client.stateGraph != null) score += 4;
  if (Array.isArray(client.bulletShots) && client.bulletShots.length > 0) score += 3;
  if (client.bulletSpawn != null) score += 1;
  if (typeof client.idle === 'string' && client.idle.length > 0) score += 1;
  if (typeof client.walk === 'string' && client.walk.length > 0) score += 1;
  if (client.cellWidthFill != null) score += 1;
  return score;
}
