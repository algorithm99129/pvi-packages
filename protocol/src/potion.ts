import type { EntityId } from './index';
import type { WalletResources } from './wallet';

/**
 * Enhancement potion effect kinds.
 * Amount semantics: percent for rate/damage/armor/speed; flat for heal/max_health;
 * percent discount for sun_discount; percent bonus for loot_bonus / crit_chance.
 */
export type PotionEffectKind =
  | 'production_rate'
  | 'damage'
  | 'armor'
  | 'heal'
  | 'attack_speed'
  | 'move_speed'
  | 'max_health'
  | 'sun_discount'
  | 'loot_bonus'
  | 'crit_chance';

export type PotionEffectScope = 'garden' | 'raid' | 'any';

export interface PotionEffect {
  kind: PotionEffectKind;
  /** Magnitude (see {@link PotionEffectKind}). */
  amount: number;
  /** Duration in seconds; 0 = instant (e.g. heal). */
  durationSec?: number;
  /** Aura / AoE radius in lawn cells when relevant (damage buffs). */
  rangeCells?: number;
  /** Where the potion applies. Default `any`. */
  scope?: PotionEffectScope;
}

export interface PotionClientAssets {
  /** PascalCase folder under Potions/, e.g. GreenThumbElixir. */
  folder: string;
  /**
   * Resources path (no extension) for the bottle avatar.
   * Defaults to `Potions/{folder}/avatar`.
   */
  image?: string;
}

export interface PotionServerConfig {
  /** Coin cost in the potion shop. */
  shopPriceCoin?: number;
  /** Gem cost in the potion shop. */
  shopPriceGem?: number;
  /** Leaf cost in the potion shop. */
  shopPriceLeaf?: number;
  /** Max stacks the player may hold (default {@link DEFAULT_POTION_STACK_LIMIT}). */
  stackLimit?: number;
}

export interface PotionDefinition {
  id: EntityId;
  displayName: string;
  description?: string;
  schemaVersion?: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  effect: PotionEffect;
  client: PotionClientAssets;
  server: PotionServerConfig;
}

export type ClientPotionExport = PotionDefinition;
export type ServerPotionExport = PotionDefinition;

export const DEFAULT_POTION_STACK_LIMIT = 20;
export const DEFAULT_POTION_DURATION_SEC = 120;
export const CURRENT_POTION_SCHEMA_VERSION = 1;

export const POTION_EFFECT_KIND_OPTIONS: ReadonlyArray<{
  id: PotionEffectKind;
  label: string;
  hint: string;
}> = [
  { id: 'production_rate', label: 'Production rate', hint: 'Faster garden coin/gem/leaf accrual (%)' },
  { id: 'damage', label: 'Damage', hint: 'Bonus damage for plants or insects (%)' },
  { id: 'armor', label: 'Armor', hint: 'Damage reduction / tougher units (%)' },
  { id: 'heal', label: 'Heal HP', hint: 'Instant HP restore (flat)' },
  { id: 'attack_speed', label: 'Attack speed', hint: 'Faster attack interval (%)' },
  { id: 'move_speed', label: 'Move speed', hint: 'Faster insect walk (%)' },
  { id: 'max_health', label: 'Max health', hint: 'Temporary max HP boost (flat or %)' },
  { id: 'sun_discount', label: 'Sun discount', hint: 'Cheaper plant packets in missions (%)' },
  { id: 'loot_bonus', label: 'Loot bonus', hint: 'More stolen garden loot (%)' },
  { id: 'crit_chance', label: 'Crit chance', hint: 'Chance for critical hits (%)' },
];

export const POTION_EFFECT_SCOPE_OPTIONS: ReadonlyArray<{
  id: PotionEffectScope;
  label: string;
}> = [
  { id: 'any', label: 'Any' },
  { id: 'garden', label: 'Garden' },
  { id: 'raid', label: 'Raid / battle' },
];

export function defaultPotionImagePath(folder: string): string {
  return `Potions/${folder}/avatar`;
}

export function defaultPotionClientAssets(folder: string): PotionClientAssets {
  return {
    folder,
    image: defaultPotionImagePath(folder),
  };
}

export function defaultPotionEffect(
  kind: PotionEffectKind = 'production_rate',
): PotionEffect {
  switch (kind) {
    case 'heal':
      return { kind, amount: 200, durationSec: 0, scope: 'raid' };
    case 'damage':
      return {
        kind,
        amount: 25,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        rangeCells: 1.5,
        scope: 'raid',
      };
    case 'armor':
      return {
        kind,
        amount: 20,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        scope: 'raid',
      };
    case 'production_rate':
      return {
        kind,
        amount: 50,
        durationSec: 600,
        scope: 'garden',
      };
    case 'sun_discount':
      return {
        kind,
        amount: 20,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        scope: 'raid',
      };
    case 'loot_bonus':
      return {
        kind,
        amount: 30,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        scope: 'raid',
      };
    default:
      return {
        kind,
        amount: 25,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        scope: 'any',
      };
  }
}

export function defaultPotionServerConfig(): PotionServerConfig {
  return {
    shopPriceCoin: 250,
    shopPriceGem: 0,
    shopPriceLeaf: 0,
    stackLimit: DEFAULT_POTION_STACK_LIMIT,
  };
}

function toPascal(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toSnake(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function normalizeEffect(
  raw: Partial<PotionEffect> | null | undefined,
): PotionEffect {
  const kind = (raw?.kind as PotionEffectKind) || 'production_rate';
  const base = defaultPotionEffect(kind);
  const amount = Number.isFinite(raw?.amount) ? Number(raw!.amount) : base.amount;
  const durationSec =
    raw?.durationSec != null && Number.isFinite(raw.durationSec)
      ? Math.max(0, Number(raw.durationSec))
      : base.durationSec;
  const rangeCells =
    raw?.rangeCells != null && Number.isFinite(raw.rangeCells)
      ? Math.max(0, Number(raw.rangeCells))
      : base.rangeCells;
  const scope = (raw?.scope as PotionEffectScope) || base.scope || 'any';
  return {
    kind,
    amount,
    durationSec,
    ...(rangeCells != null ? { rangeCells } : {}),
    scope,
  };
}

export function normalizePotionDefinition(
  raw: Partial<PotionDefinition> & { folder?: string } | null | undefined,
): PotionDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const folder =
    raw.client?.folder?.trim() ||
    raw.folder?.trim() ||
    (raw.displayName ? toPascal(raw.displayName) : '') ||
    (raw.id ? toPascal(raw.id) : '');
  if (!folder) return null;
  const id = raw.id?.trim() || toSnake(folder);
  if (!id) return null;

  const rarity = (raw.rarity as PotionDefinition['rarity']) || 'common';
  const server = raw.server ?? {};

  return {
    id,
    displayName: raw.displayName?.trim() || folder,
    description: raw.description?.trim() || undefined,
    schemaVersion:
      typeof raw.schemaVersion === 'number'
        ? raw.schemaVersion
        : CURRENT_POTION_SCHEMA_VERSION,
    rarity,
    effect: normalizeEffect(raw.effect),
    client: {
      folder,
      image: raw.client?.image?.trim() || defaultPotionImagePath(folder),
    },
    server: {
      shopPriceCoin: Math.max(
        0,
        Math.floor(
          Number.isFinite(server.shopPriceCoin)
            ? Number(server.shopPriceCoin)
            : defaultPotionServerConfig().shopPriceCoin!,
        ),
      ),
      shopPriceGem: Math.max(
        0,
        Math.floor(
          Number.isFinite(server.shopPriceGem) ? Number(server.shopPriceGem) : 0,
        ),
      ),
      shopPriceLeaf: Math.max(
        0,
        Math.floor(
          Number.isFinite(server.shopPriceLeaf) ? Number(server.shopPriceLeaf) : 0,
        ),
      ),
      stackLimit: Math.max(
        1,
        Math.floor(
          Number.isFinite(server.stackLimit)
            ? Number(server.stackLimit)
            : DEFAULT_POTION_STACK_LIMIT,
        ),
      ),
    },
  };
}

export function createPotionDefinition(
  partial?: Omit<Partial<PotionDefinition>, 'client' | 'effect' | 'server'> & {
    folder?: string;
    client?: Partial<PotionClientAssets>;
    effect?: Partial<PotionEffect>;
    server?: Partial<PotionServerConfig>;
  },
): PotionDefinition {
  const folder =
    partial?.client?.folder ??
    partial?.folder ??
    (partial?.displayName ? toPascal(partial.displayName) : 'GreenThumbElixir');
  const id = partial?.id && partial.id.length > 0 ? partial.id : toSnake(folder);
  const effectKind = (partial?.effect?.kind as PotionEffectKind) || 'production_rate';
  return normalizePotionDefinition({
    ...partial,
    id,
    displayName: partial?.displayName ?? folder,
    client: {
      ...defaultPotionClientAssets(folder),
      ...partial?.client,
      folder,
    },
    effect: {
      ...defaultPotionEffect(effectKind),
      ...partial?.effect,
    },
    server: {
      ...defaultPotionServerConfig(),
      ...partial?.server,
    },
  })!;
}

/** Shop price as wallet resources (zeros omitted still return full object). */
export function resolvePotionShopPrice(potion: PotionDefinition): WalletResources {
  return {
    coin: Math.max(0, Math.floor(Number(potion.server?.shopPriceCoin) || 0)),
    gem: Math.max(0, Math.floor(Number(potion.server?.shopPriceGem) || 0)),
    leaf: Math.max(0, Math.floor(Number(potion.server?.shopPriceLeaf) || 0)),
  };
}

/** One owned potion stack on the player. */
export interface UserPotionStack {
  potionId: EntityId;
  quantity: number;
}

/** Where the player is consuming a potion. */
export type PotionUseContext = 'garden' | 'raid';

/**
 * Timed buff written when a potion with durationSec &gt; 0 is used.
 * Instant effects (heal) are not stored — clients apply them from {@link UsePotionResult.effect}.
 */
export interface ActivePotionBuff {
  potionId: EntityId;
  kind: PotionEffectKind;
  amount: number;
  scope: PotionEffectScope;
  rangeCells?: number;
  /** ISO timestamp when the buff started. */
  startedAt: string;
  /** ISO timestamp when the buff ends; null if already expired / unknown. */
  expiresAt: string | null;
}

/** Request body for POST /api/potions/:potionId/use */
export interface UsePotionRequest {
  context: PotionUseContext;
}

/** Response from POST /api/potions/:potionId/use */
export interface UsePotionResult {
  potionId: EntityId;
  /** Remaining owned quantity after consume. */
  quantity: number;
  inventory: UserPotionStack[];
  activeBuffs: ActivePotionBuff[];
  /** Effect applied by this use (for instant heal / client apply). */
  effect: PotionEffect;
}

/** Response from POST /api/potions/:potionId/purchase */
export interface PurchasePotionResult {
  potionId: EntityId;
  quantity: number;
  wallet: WalletResources;
}

export function potionMatchesUseContext(
  scope: PotionEffectScope | undefined,
  context: PotionUseContext,
): boolean {
  const s = scope ?? 'any';
  if (s === 'any') return true;
  return s === context;
}

export function pruneExpiredPotionBuffs(
  buffs: ActivePotionBuff[] | null | undefined,
  nowMs: number = Date.now(),
): ActivePotionBuff[] {
  if (!Array.isArray(buffs) || buffs.length === 0) return [];
  return buffs.filter((row) => {
    if (!row || !row.potionId || !row.kind) return false;
    if (row.expiresAt == null || row.expiresAt === '') return true;
    const exp = Date.parse(row.expiresAt);
    return Number.isFinite(exp) && exp > nowMs;
  });
}

/** Sum of active buff amounts for a kind (percent or flat, depending on kind). */
export function sumActivePotionEffect(
  buffs: ActivePotionBuff[] | null | undefined,
  kind: PotionEffectKind,
  nowMs: number = Date.now(),
): number {
  const live = pruneExpiredPotionBuffs(buffs, nowMs);
  let total = 0;
  for (const row of live) {
    if (row.kind !== kind) continue;
    const n = Number(row.amount);
    if (!Number.isFinite(n)) continue;
    total += n;
  }
  return total;
}

/** Convert a percent buff amount into a multiplier (50 → 1.5). */
export function potionPercentMultiplier(percentAmount: number): number {
  const pct = Number.isFinite(percentAmount) ? percentAmount : 0;
  return Math.max(0, 1 + pct / 100);
}

export function normalizeActivePotionBuff(
  raw: Partial<ActivePotionBuff> | null | undefined,
): ActivePotionBuff | null {
  if (!raw || typeof raw !== 'object') return null;
  const potionId = String(raw.potionId ?? '').trim();
  const kind = raw.kind as PotionEffectKind;
  if (!potionId || !kind) return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  const scope = (raw.scope as PotionEffectScope) || 'any';
  const startedAt =
    typeof raw.startedAt === 'string' && raw.startedAt.trim()
      ? raw.startedAt.trim()
      : new Date().toISOString();
  let expiresAt: string | null = null;
  if (raw.expiresAt != null && String(raw.expiresAt).trim()) {
    expiresAt = String(raw.expiresAt).trim();
  }
  const rangeCells =
    raw.rangeCells != null && Number.isFinite(Number(raw.rangeCells))
      ? Math.max(0, Number(raw.rangeCells))
      : undefined;
  return {
    potionId,
    kind,
    amount,
    scope,
    startedAt,
    expiresAt,
    ...(rangeCells != null ? { rangeCells } : {}),
  };
}
