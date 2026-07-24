import type { EntityId } from './index';
import type { WalletResources } from './wallet';
import type { EquipmentHitbox } from './equipment';

export type InsectArchetype =
  | 'swarm'
  | 'tank'
  | 'flyer'
  | 'burrower'
  | 'siege'
  | 'runner'
  | 'support';

export interface InsectDefinition {
  id: EntityId;
  displayName: string;
  archetype: InsectArchetype;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  /** JSON schema generation; missing = legacy (0). */
  schemaVersion?: number;
  stats: InsectStatCurve;
  client: InsectClientAssets;
  server: InsectServerConfig;
  /** Leveling and upgrade costs (formula-driven). */
  upgrade?: InsectUpgradeConfig;
  /** Per-unit knobs addressable as `extra.<key>` in the status graph. */
  extraAttributes?: ExtraAttributes;
}

/** Max insect level (roster upgrades). Matches DEFAULT_INSECT_UPGRADE.maxLevel. */
export const INSECT_MAX_LEVEL = 20;

/** Per-insect upgrade tuning — costs evaluated via logic.json formulas. */
export interface InsectUpgradeConfig {
  maxLevel: number;
  /** Formula id for stat at level (inputs: base, perLevel, level). */
  statFormulaId: string;
  /** Formula id for next-level upgrade cost per resource (inputs: base, level). */
  costFormulaId: string;
  baseUpgradeCost: WalletResources;
}

/** MVP: reuse plant formulas until nectar/chitin economy lands. */
export const DEFAULT_INSECT_UPGRADE: InsectUpgradeConfig = {
  maxLevel: INSECT_MAX_LEVEL,
  statFormulaId: 'plant_stat_at_level',
  costFormulaId: 'plant_upgrade_resource_cost',
  baseUpgradeCost: { coin: 100, gem: 0, leaf: 2 },
};

export function resolveInsectUpgrade(insect: Pick<InsectDefinition, 'upgrade'>): InsectUpgradeConfig {
  return insect.upgrade ?? DEFAULT_INSECT_UPGRADE;
}

export interface InsectStatCurve {
  baseHealth: number;
  baseDamage: number;
  moveSpeed: number;
  attackIntervalMs: number;
  levelScaling: {
    healthPerLevel: number;
    damagePerLevel: number;
    milestones?: Record<number, { trait?: string }>;
  };
}

import type { GfxRectCrop, GfxAnimationSlot } from './gfx';
import type { UnitCellAnchor } from './unit-sizing';
import type { ExtraAttributes } from './extra-attributes';
import type { EntityStateGraph } from './entity-state-graph';
import { mirrorInsectClipsFromGraph } from './entity-state-graph';

/** Legacy PvZ zombie entity ids → Garden Siege insect ids (saved progress / old content). */
export const LEGACY_INSECT_ID_ALIASES: Record<string, string> = {
  normal_zombie: 'worker_beetle',
  conehead_zombie: 'horn_beetle',
  buckethead_zombie: 'bucket_weevil',
  flag_zombie: 'banner_wasp',
  newspaper_zombie: 'ledger_roach',
};

/** Resolve a possibly-legacy insect id to the canonical catalog id. */
export function resolveInsectId(id: string): string {
  return LEGACY_INSECT_ID_ALIASES[id] ?? id;
}

export interface InsectClientAssets {
  /** PascalCase unit folder under Insects/, e.g. WorkerBeetle */
  folder: string;
  /**
   * @deprecated Prefer `stateGraph`. Mirrored from the walk / entry node.
   */
  walk: string;
  /** @deprecated Prefer stateGraph attack node. */
  attack?: string;
  /** @deprecated Prefer stateGraph.die.spineAnim. */
  die?: string;
  /** Status graph — statuses, AND conditions, and predefined engine actions. */
  stateGraph?: EntityStateGraph;
  extraAnimations?: GfxAnimationSlot[];
  cropX?: number;
  cropWidth?: number;
  crop?: GfxRectCrop;
  /**
   * Art placement inside one grid cell (0–1 anchors, bottom-left origin).
   * Prefer this over legacy `cellWidthFill` / `scale`.
   */
  cellAnchor?: UnitCellAnchor;
  /**
   * @deprecated Prefer `cellAnchor`. Fraction of grid cell width (0–1).
   * Kept in sync with `cellAnchor.maxX - cellAnchor.minX` when the editor saves.
   */
  cellWidthFill?: number;
  /**
   * @deprecated Prefer `cellAnchor`. Extra multiplier after cell-width fitting.
   */
  scale?: number;
  /** Optional equipment catalog id (helmet, door, …). */
  equipmentId?: EntityId;
  /**
   * Per-insect equipment AABB (cell-width fractions, local to insect root).
   * Same catalog piece can sit differently on each insect — edit on the insect page.
   * Runtime falls back to the equipment catalog default when omitted.
   */
  equipmentHitbox?: EquipmentHitbox;
}

/** Persist graph and keep legacy walk/attack/die fields mirrored. */
export function withInsectStateGraph(
  client: InsectClientAssets,
  graph: EntityStateGraph,
): InsectClientAssets {
  const clips = mirrorInsectClipsFromGraph(graph);
  return {
    ...client,
    stateGraph: graph,
    walk: clips.walk || client.walk || client.folder,
    attack: clips.attack,
    die: clips.die,
  };
}

export type InsectTravelLayer = 'ground' | 'flying' | 'burrow';

export const INSECT_TRAVEL_LAYER_OPTIONS: ReadonlyArray<{
  id: InsectTravelLayer;
  label: string;
  hint: string;
}> = [
  {
    id: 'ground',
    label: 'Ground',
    hint: 'Walks the lane and bites plants (default)',
  },
  {
    id: 'flying',
    label: 'Air',
    hint: 'Flies over ground plants until popped (Balloon)',
  },
  {
    id: 'burrow',
    label: 'Underground',
    hint: 'Travels underground; untargetable until it surfaces (Digger)',
  },
];

const TRAVEL_LAYER_SET = new Set<string>(INSECT_TRAVEL_LAYER_OPTIONS.map((o) => o.id));

/** Normalize authored / legacy travel-layer keys. */
export function normalizeLaneBehavior(raw: unknown): InsectTravelLayer {
  if (typeof raw !== 'string') return 'ground';
  const s = raw.trim().toLowerCase().replace(/-/g, '_');
  if (TRAVEL_LAYER_SET.has(s)) return s as InsectTravelLayer;
  if (s === 'air' || s === 'flyer' || s === 'fly') return 'flying';
  if (s === 'underground' || s === 'under' || s === 'dig' || s === 'digger') return 'burrow';
  return 'ground';
}

export interface InsectServerConfig {
  unlockSource: 'story' | 'goal' | 'event' | 'default';
  unlockRef?: string;
  /**
   * How this insect travels the lane (classic PvZ ground / air / underground).
   * Separate from {@link InsectArchetype} — archetype is roster flavor; this drives combat.
   */
  laneBehavior: InsectTravelLayer;
  burrowSkipsPlants?: number;
  /**
   * Attacker loadout card recharge after deploying this insect (seconds).
   * Prefer explicit authorship; {@link resolveInsectRechargeSeconds} fills defaults.
   */
  rechargeSeconds?: number;
}

/** Default insect card recharge (seconds) when not authored. */
export const INSECT_RECHARGE_DEFAULT = 10;

/** Resolve insect loadout card recharge seconds. */
export function resolveInsectRechargeSeconds(insect: {
  id?: string;
  archetype?: InsectArchetype;
  server?: Pick<InsectServerConfig, 'rechargeSeconds'>;
}): number {
  const authored = insect.server?.rechargeSeconds;
  if (typeof authored === 'number' && Number.isFinite(authored) && authored > 0)
    return authored;
  if (insect.archetype === 'siege' || insect.archetype === 'tank') return 20;
  if (insect.archetype === 'support') return 15;
  return INSECT_RECHARGE_DEFAULT;
}

export interface ServerInsectExport {
  id: EntityId;
  displayName: string;
  description: string;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  schemaVersion?: number;
  client: InsectClientAssets;
  stats: InsectStatCurve;
  server: InsectServerConfig;
  upgrade?: InsectUpgradeConfig;
  extraAttributes?: ExtraAttributes;
}

export interface ClientInsectExport {
  id: EntityId;
  displayName: string;
  archetype: InsectArchetype;
  rarity: InsectDefinition['rarity'];
  description: string;
  schemaVersion?: number;
  client: InsectClientAssets;
  stats: InsectStatCurve;
  extraAttributes?: ExtraAttributes;
}
