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
    hint: 'Pitcher Snare / Maw digest duration before returning to idle',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'holdSeconds',
    label: 'Hold seconds',
    hint: 'Deprecated for chomp_devour (eating kills). Prefer extra.heavySlowSeconds for heavy chill.',
    type: 'number',
    defaultValue: 4,
  },
  {
    key: 'heavySlowSeconds',
    label: 'Heavy slow seconds',
    hint: 'Chill duration when chomp_devour mode=trap_or_slow hits a Heavy',
    type: 'number',
    defaultValue: 4,
  },
  {
    key: 'heavySlowScale',
    label: 'Heavy slow scale',
    hint: 'Move-speed scale for heavy chill in chomp_devour mode=trap_or_slow (0.65 = 35% slow)',
    type: 'number',
    defaultValue: 0.65,
  },
  {
    key: 'prepareSeconds',
    label: 'Prepare seconds',
    hint: 'Arming delay (Burrow Beetroot) or Butterfly Glider egg-lay wait',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'chewSeconds',
    label: 'Chew seconds',
    hint: 'Nest Breaker digest time before destroy_egg_group (default 3)',
    type: 'number',
    defaultValue: 3,
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
    key: 'healIdleSeconds',
    label: 'Heal idle seconds',
    hint: 'Must be undamaged this long before heal pulses (Bubble Aloe). Bind on not_damaged_for.',
    type: 'number',
    defaultValue: 2,
  },
  {
    key: 'healPercentMaxHp',
    label: 'Heal percent max HP',
    hint: 'Fraction of target max HP healed by heal_ally (Bubble Aloe / Nectar Nurse)',
    type: 'number',
    defaultValue: 0.15,
  },
  {
    key: 'healAmount',
    label: 'Heal amount (flat)',
    hint: 'Flat HP restored by heal_insect (Honeybee Courier = 100)',
    type: 'number',
    defaultValue: 100,
  },
  {
    key: 'healIntervalSeconds',
    label: 'Heal interval seconds',
    hint: 'Graph after_seconds between Honeybee deliveries (not special_ready)',
    type: 'number',
    defaultValue: 8,
  },
  {
    key: 'flySeconds',
    label: 'Fly leg seconds',
    hint: 'One-way flight time for fly_to_ally',
    type: 'number',
    defaultValue: 0.55,
  },
  {
    key: 'hideOpacity',
    label: 'Hide opacity',
    hint: 'Alpha while hide action is active (shy plants)',
    type: 'number',
    defaultValue: 0.4,
  },
  {
    key: 'hideSeconds',
    label: 'Hide seconds',
    hint: 'Timed hide window; 0 = until unhide. Bind on hide.duration.',
    type: 'number',
    defaultValue: 0,
  },
  {
    key: 'hideProximityColumns',
    label: 'Hide proximity columns',
    hint: 'Column distance that makes a shy shooter fold shut / hide',
    type: 'number',
    defaultValue: 1.5,
  },
  {
    key: 'minRangeColumns',
    label: 'Minimum range columns',
    hint: 'Ignore enemies closer than this (Pinecone Mortar). Bind on enemy_in_range.minRange.',
    type: 'number',
    defaultValue: 2,
  },
  {
    key: 'fogClearRadius',
    label: 'Fog clear radius',
    hint: 'Chebyshev cells for clear_fog / reveal auras (Lantern Lily; 1 = 3×3)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'dustColumnRange',
    label: 'Dust column range',
    hint: 'Moon Moth dust_veil affection along the lane (walking ground insects skip ranged targeting)',
    type: 'number',
    defaultValue: 2.5,
  },
  {
    key: 'dustLaneRange',
    label: 'Dust lane range',
    hint: 'Moon Moth dust_veil affection across lanes (0 = same lane only)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'aerialProtectRadius',
    label: 'Aerial protect radius',
    hint: 'Chebyshev cells protected from aerial steal when server.blocksAerialSteal (1 = 3×3)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'aerialProtectColumnRange',
    label: 'Aerial protect column range',
    hint: 'discard_aerial_impact canopy column radius (1 = ±1 → 3-wide)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'aerialProtectLaneRange',
    label: 'Aerial protect lane range',
    hint: 'discard_aerial_impact canopy lane radius (1 = ±1 → 3-tall)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'produceSunAmount',
    label: 'Produce sun amount',
    hint: 'Resource granted by produce_sun (Honeycomb Clover = 50, Sunleaf Banker default 25)',
    type: 'number',
    defaultValue: 25,
  },
  {
    key: 'produceSunAmountInitial',
    label: 'Produce sun amount (initial)',
    hint: 'Smaller pulse before growth (Nightleaf Banker). Used with produceSunGrowAfter.',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'produceSunGrowAfter',
    label: 'Produce sun grow after count',
    hint: 'After this many produce pulses, switch from initial to produceSunAmount',
    type: 'number',
    defaultValue: 2,
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
    hint: 'Lane radius for a blast (0 = same lane only; 1 = ±1 lane). Lane Ember uses 0 and a wide column span.',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'explodeColumnRange',
    label: 'Explode column range',
    hint: 'Firefly / suicide blast affection along the lane',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'explodeLaneRange',
    label: 'Explode lane range',
    hint: 'Firefly / suicide blast affection across lanes',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'craterRadiusCells',
    label: 'Crater radius (cells)',
    hint: 'Crater Cap leave_crater Chebyshev radius (0 = plant cell only)',
    type: 'number',
    defaultValue: 0,
  },
  {
    key: 'splashColumnRange',
    label: 'Splash column range',
    hint: 'Extra splash radius around a Mallet Mushroom or similar slam',
    type: 'number',
    defaultValue: 0.55,
  },
  {
    key: 'splashLaneRange',
    label: 'Splash lane range',
    hint: 'Lane radius for a Mallet Mushroom slam (0 = same lane)',
    type: 'number',
    defaultValue: 0,
  },
  {
    key: 'magnetHoldSeconds',
    label: 'Magnet hold seconds',
    hint: 'How long Lodestone Bloom holds stolen metal before it can pull again',
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
    key: 'gelDurationSeconds',
    label: 'Gel duration seconds',
    hint: 'How long leave_gel cells remain before melting (Slug Slimer = 10)',
    type: 'number',
    defaultValue: 10,
  },
  {
    key: 'gelMoveSpeedScale',
    label: 'Gel move-speed scale',
    hint: 'Insects standing on gel multiply move speed by this (Slug Slimer = 1.35)',
    type: 'number',
    defaultValue: 1.35,
  },
  {
    key: 'chillDurationSeconds',
    label: 'Chill duration seconds',
    hint: 'Slow leftover after Ice-shroom freeze thaws',
    type: 'number',
    defaultValue: 10,
  },
  {
    key: 'underwaterClipHeight',
    label: 'Underwater clip height',
    hint: 'Wire via status-graph modifiers → Unit attribute (extra.underwaterClipHeight). 0 = above waterline, 1 = fully under.',
    type: 'number',
    defaultValue: 0.55,
  },
  {
    key: 'undergroundClipHeight',
    label: 'Underground clip height',
    hint: 'Same clip method as snorkel; groundline is the editor character bottom (cellAnchor), not cell center. Wire via burrow status → extra.undergroundClipHeight.',
    type: 'number',
    defaultValue: 0.55,
  },
  {
    key: 'emergeWaitSeconds',
    label: 'Emerge wait seconds',
    hint: 'Pause after digger surfaces before reverse-march (status graph after_seconds).',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'waterEdgeParticleScale',
    label: 'Water edge particle scale',
    hint: 'Optional scale for the waterline ripple while clipped (read by waterline VFX).',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'throwInsectId',
    label: 'Throw insect id',
    hint: 'Catalog id spawned by throw_unit (Bumble Queen → Honeybee Courier)',
    type: 'string',
    defaultValue: 'honeybee_courier',
  },
  {
    key: 'summonInsectId',
    label: 'Summon insect id',
    hint: 'Catalog id spawned by summon_insect (Dancing Firefly → backup_gnat)',
    type: 'string',
    defaultValue: 'glowworm_trail',
  },
  {
    key: 'crushesPlantsWhileMoving',
    label: 'Crushes plants while moving',
    hint: 'Frost Roller: flatten plants underfoot without stopping to chew (>0 = on)',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'vehicleHits',
    label: 'Vehicle hits',
    hint: 'Spikeweed/Spikerock: how many rollers/vehicles this hazard pops before exploding',
    type: 'number',
    defaultValue: 1,
  },
  {
    key: 'retaliationDamage',
    label: 'Retaliation damage',
    hint: 'Wire via deal_contact_damage.damage → extra.retaliationDamage (Bramble Bulwark)',
    type: 'number',
    defaultValue: 15,
  },
  {
    key: 'fuseSeconds',
    label: 'Fuse seconds',
    hint: 'Wire via arm_burst.fuseDuration → extra.fuseSeconds',
    type: 'number',
    defaultValue: 8,
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
  {
    path: 'stats.baseDamage',
    label: 'stats.baseDamage',
    hint: 'This unit’s damage (includes level scaling in combat)',
    kind: 'both',
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
