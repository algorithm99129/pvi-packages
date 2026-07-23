/** Per-unit authored attributes addressable as `extra.<key>` in the state graph. */

export type ExtraAttributeType = 'number' | 'string' | 'formula';

export interface ExtraAttributeDef {
  /** Stable key → graph path `extra.<key>` */
  key: string;
  label?: string;
  type: ExtraAttributeType;
  /** number / string literal (also holds baked formula result for Unity). */
  value?: number | string;
  /** When type === 'formula': id from logic.json formulas. */
  formulaId?: string;
}

export type ExtraAttributes = ExtraAttributeDef[];

/** Suggested keys for the “add attribute” picker (not exhaustive). */
export const EXTRA_ATTRIBUTE_SUGGESTIONS: ReadonlyArray<{
  key: string;
  label: string;
  hint: string;
  type: ExtraAttributeType;
  defaultValue?: number | string;
}> = [
  {
    key: 'digestSeconds',
    label: 'Digest seconds',
    hint: 'Chomper digest duration before returning to idle',
    type: 'number',
    defaultValue: 42,
  },
  {
    key: 'prepareSeconds',
    label: 'Prepare seconds',
    hint: 'Arming / prepare duration (Potato Mine, etc.)',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'detonateDelaySeconds',
    label: 'Detonate delay seconds',
    hint: 'Delay before instant explode',
    type: 'number',
    defaultValue: 0.65,
  },
  {
    key: 'produceIntervalSeconds',
    label: 'Produce interval seconds',
    hint: 'Sun / resource production interval',
    type: 'number',
    defaultValue: 24,
  },
  {
    key: 'hideProximityColumns',
    label: 'Hide proximity columns',
    hint: 'Column distance that triggers hide (Scaredy-shroom)',
    type: 'number',
    defaultValue: 1.5,
  },
  {
    key: 'triggerColumnRange',
    label: 'Trigger column range',
    hint: 'Melee / trap / explode column radius',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'triggerLaneRange',
    label: 'Trigger lane range',
    hint: 'Explode lane radius (0 = same lane only; 1 = ±1 lane). Jalapeno uses 0 + wide columns',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'splashColumnRange',
    label: 'Splash column range',
    hint: 'Extra crush/splash radius around Squash impact (near the primary target)',
    type: 'number',
    defaultValue: 0.55,
  },
  {
    key: 'splashLaneRange',
    label: 'Splash lane range',
    hint: 'Lane radius for Squash splash (0 = same lane)',
    type: 'number',
    defaultValue: 0,
  },
  {
    key: 'magnetHoldSeconds',
    label: 'Magnet hold seconds',
    hint: 'How long Magnet-shroom holds stolen metal before it can pull again',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'freezeDurationSeconds',
    label: 'Freeze duration seconds',
    hint: 'How long Ice-shroom keeps insects fully frozen',
    type: 'number',
    defaultValue: 4,
  },
  {
    key: 'chillDurationSeconds',
    label: 'Chill duration seconds',
    hint: 'Slow leftover after Ice-shroom freeze thaws',
    type: 'number',
    defaultValue: 10,
  },
];

export function extraPath(key: string): string {
  return `extra.${key.trim()}`;
}

export function parseExtraPath(path: string): string | null {
  const p = path.trim();
  if (!p.startsWith('extra.')) return null;
  const key = p.slice('extra.'.length).trim();
  return key.length > 0 ? key : null;
}

export function findExtraAttribute(
  attrs: ExtraAttributes | undefined | null,
  key: string,
): ExtraAttributeDef | undefined {
  if (!attrs || !key) return undefined;
  return attrs.find((a) => a.key === key);
}

/** Read a numeric extra attribute (literal value only — formulas must be baked first). */
export function getExtraNumber(
  attrs: ExtraAttributes | undefined | null,
  key: string,
): number | undefined {
  const attr = findExtraAttribute(attrs, key);
  if (!attr) return undefined;
  const n = Number(attr.value);
  return Number.isFinite(n) ? n : undefined;
}

export function getExtraString(
  attrs: ExtraAttributes | undefined | null,
  key: string,
): string | undefined {
  const attr = findExtraAttribute(attrs, key);
  if (!attr) return undefined;
  if (attr.value === undefined || attr.value === null) return undefined;
  return String(attr.value);
}

/** Paths for the state-graph duration picker from a unit’s extras. */
export function listExtraAttributePaths(
  attrs: ExtraAttributes | undefined | null,
): Array<{ path: string; label: string; hint: string }> {
  if (!attrs || attrs.length === 0) return [];
  return attrs.map((a) => ({
    path: extraPath(a.key),
    label: a.label ? `${a.label} (extra.${a.key})` : `extra.${a.key}`,
    hint: a.type === 'formula' ? `Formula ${a.formulaId ?? '—'}` : `Extra ${a.type}`,
  }));
}

export function normalizeExtraAttributes(
  raw: unknown,
): ExtraAttributes | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExtraAttributeDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const type: ExtraAttributeType =
      row.type === 'string' || row.type === 'formula' || row.type === 'number'
        ? row.type
        : 'number';
    const def: ExtraAttributeDef = { key, type };
    if (typeof row.label === 'string' && row.label.trim()) def.label = row.label.trim();
    if (type === 'formula' && typeof row.formulaId === 'string') {
      def.formulaId = row.formulaId;
    }
    if (row.value !== undefined && row.value !== null) {
      if (type === 'string') def.value = String(row.value);
      else {
        const n = Number(row.value);
        if (Number.isFinite(n)) def.value = n;
      }
    }
    out.push(def);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Ensure formula-backed extras have a numeric `value` for Unity / runtime.
 * Keeps `formulaId` so the editor can re-open formula authorship.
 */
export function bakeExtraAttributesForRuntime(
  attrs: ExtraAttributes | undefined | null,
  resolveFormula?: (formulaId: string) => number | undefined,
): ExtraAttributes | undefined {
  if (!attrs || attrs.length === 0) return attrs ?? undefined;
  return attrs.map((a) => {
    if (a.type !== 'formula') return { ...a };
    let n: number | undefined;
    if (a.formulaId && resolveFormula) {
      const resolved = resolveFormula(a.formulaId);
      if (resolved !== undefined && Number.isFinite(resolved)) n = resolved;
    }
    if (n === undefined) {
      const fallback = Number(a.value);
      n = Number.isFinite(fallback) ? fallback : 0;
    }
    return { ...a, value: n };
  });
}

/** Built-in duration attribute paths that are not unit extras. */
export const BUILTIN_DURATION_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  path: string;
  label: string;
  hint: string;
  kind?: 'plant' | 'insect' | 'both';
  fromMs?: boolean;
}> = [
  {
    path: 'stats.attackIntervalMs',
    label: 'stats.attackIntervalMs',
    hint: 'Attack interval converted from milliseconds to seconds',
    kind: 'both',
    fromMs: true,
  },
];

/**
 * Legacy behavior.* paths still accepted by resolvers for older graphs.
 * Prefer extra.* going forward.
 */
export const LEGACY_BEHAVIOR_DURATION_OPTIONS: ReadonlyArray<{
  path: string;
  label: string;
  hint: string;
  kind?: 'plant' | 'insect' | 'both';
  fromMs?: boolean;
  /** Maps to extra key for dual-read. */
  extraKey: string;
}> = [
  {
    path: 'behavior.digestSeconds',
    label: 'behavior.digestSeconds (legacy)',
    hint: 'Prefer extra.digestSeconds',
    kind: 'plant',
    extraKey: 'digestSeconds',
  },
  {
    path: 'behavior.prepareSeconds',
    label: 'behavior.prepareSeconds (legacy)',
    hint: 'Prefer extra.prepareSeconds',
    kind: 'plant',
    extraKey: 'prepareSeconds',
  },
  {
    path: 'behavior.detonateDelaySeconds',
    label: 'behavior.detonateDelaySeconds (legacy)',
    hint: 'Prefer extra.detonateDelaySeconds',
    kind: 'plant',
    extraKey: 'detonateDelaySeconds',
  },
  {
    path: 'behavior.produceIntervalSeconds',
    label: 'behavior.produceIntervalSeconds (legacy)',
    hint: 'Prefer extra.produceIntervalSeconds',
    kind: 'plant',
    extraKey: 'produceIntervalSeconds',
  },
];
