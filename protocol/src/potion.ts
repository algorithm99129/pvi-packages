import type { EntityId } from './index';
import type { PlantRole } from './plant';
import type { WalletResources } from './wallet';

/**
 * Enhancement potion effect kinds.
 * Amount semantics: percent for rate/damage/armor/speed; flat for heal;
 * poison amount = DPS; freeze amount unused (durationSec drives length).
 * Legacy kinds kept for migration prune safety.
 */
export type PotionEffectKind =
  | 'production_rate'
  | 'damage'
  | 'armor'
  | 'heal'
  | 'attack_speed'
  | 'freeze'
  | 'poison'
  | 'move_speed'
  | 'max_health'
  | 'sun_discount'
  | 'loot_bonus'
  | 'crit_chance';

/** @deprecated Prefer {@link PotionCategory}; kept for ActivePotionBuff compatibility. */
export type PotionEffectScope = 'garden' | 'raid' | 'any';

export type PotionCategory = 'garden' | 'battle';

/** Battle drop shape: single unit vs area around a cell/unit. */
export type PotionTargetShape = 'none' | 'single' | 'aoe';

/**
 * @deprecated Prefer {@link PotionTargetShape} + {@link PotionBattleSide} + {@link PotionBattleUnitKind}.
 * Still accepted / emitted for older client payloads.
 */
export type PotionTargetMode =
  | 'none'
  | 'ally_unit'
  | 'enemy_unit'
  | 'ally_aoe'
  | 'enemy_aoe'
  | 'single'
  | 'aoe';

export type PotionBattleSide = 'ally' | 'enemy';
export type PotionBattleUnitKind = 'plant' | 'insect' | 'any';

/** Which planted garden plants a garden potion affects. */
export type PotionGardenPlantFilter = 'all' | 'role' | 'plant_ids';

export type PotionProductionResource = 'all' | 'coin' | 'gem' | 'leaf';

export interface PotionEffect {
  kind: PotionEffectKind;
  /** Magnitude (see {@link PotionEffectKind}). */
  amount: number;
  /** Duration in seconds; 0 = instant (e.g. heal). Garden default ~24h; battle ~3–5s. */
  durationSec?: number;
  /** Aura / AoE radius in lawn cells when shape is aoe. */
  rangeCells?: number;
  /** Where the potion applies. Default from category. */
  scope?: PotionEffectScope;
  /** Battle drop shape. Garden uses `none`. */
  targetShape?: PotionTargetShape;
  /**
   * @deprecated Prefer targetShape + battleSide + battleUnitKind.
   */
  targetMode?: PotionTargetMode;
  /** Ally (your team) or enemy team in battle. */
  battleSide?: PotionBattleSide;
  /** Plant, insect, or either. */
  battleUnitKind?: PotionBattleUnitKind;
  /** Garden production resource filter when kind is production_rate. */
  resource?: PotionProductionResource;
  /** Garden: all plants, plants of a role, or explicit plant ids. */
  gardenPlantFilter?: PotionGardenPlantFilter;
  /** When gardenPlantFilter is `role`. */
  gardenRole?: PlantRole;
  /** When gardenPlantFilter is `plant_ids`. */
  gardenPlantIds?: EntityId[];
}

export interface PotionClientAssets {
  /** PascalCase folder under Potions/, e.g. GrowthBoost. */
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
  /** Garden (dialog Use) vs battle (loadout + targeted use). */
  category: PotionCategory;
  effect: PotionEffect;
  client: PotionClientAssets;
  server: PotionServerConfig;
}

export type ClientPotionExport = PotionDefinition;
export type ServerPotionExport = PotionDefinition;

export const DEFAULT_POTION_STACK_LIMIT = 20;
export const DEFAULT_POTION_DURATION_SEC = 5;
/** Default garden buff length: 24 hours. */
export const DEFAULT_GARDEN_POTION_DURATION_SEC = 86_400;
export const CURRENT_POTION_SCHEMA_VERSION = 3;
export const BATTLE_POTION_SLOT_COUNT = 5;

const PLANT_ROLES: ReadonlyArray<PlantRole> = [
  'shooter',
  'splash',
  'blocker',
  'trap',
  'support',
  'disruptor',
  'anti_air',
  'utility',
];

/** Effect kinds shown in the editor for new potions. */
export const POTION_EFFECT_KIND_OPTIONS: ReadonlyArray<{
  id: PotionEffectKind;
  label: string;
  hint: string;
}> = [
  { id: 'production_rate', label: 'Production rate', hint: 'Faster garden coin/gem/leaf accrual (%)' },
  { id: 'damage', label: 'Damage', hint: 'Bonus damage (%)' },
  { id: 'armor', label: 'Armor', hint: 'Damage reduction (%)' },
  { id: 'heal', label: 'Heal HP', hint: 'Instant HP restore (flat)' },
  { id: 'attack_speed', label: 'Attack speed', hint: 'Faster attack interval (%)' },
  { id: 'move_speed', label: 'Move speed', hint: 'Faster walk speed (%)' },
  { id: 'freeze', label: 'Freeze', hint: 'Freeze / chill (duration)' },
  { id: 'poison', label: 'Poison', hint: 'Damage over time (DPS)' },
];

export const POTION_CATEGORY_OPTIONS: ReadonlyArray<{
  id: PotionCategory;
  label: string;
}> = [
  { id: 'garden', label: 'Garden' },
  { id: 'battle', label: 'Battle' },
];

export const POTION_TARGET_SHAPE_OPTIONS: ReadonlyArray<{
  id: PotionTargetShape;
  label: string;
  hint: string;
}> = [
  { id: 'none', label: 'None', hint: 'Dialog Use only (garden)' },
  { id: 'single', label: 'Single unit', hint: 'Drop on one character' },
  { id: 'aoe', label: 'Area', hint: 'Affect units in range around drop' },
];

export const POTION_BATTLE_SIDE_OPTIONS: ReadonlyArray<{
  id: PotionBattleSide;
  label: string;
}> = [
  { id: 'ally', label: 'Your team' },
  { id: 'enemy', label: 'Enemy team' },
];

export const POTION_BATTLE_UNIT_KIND_OPTIONS: ReadonlyArray<{
  id: PotionBattleUnitKind;
  label: string;
}> = [
  { id: 'plant', label: 'Plant' },
  { id: 'insect', label: 'Insect' },
  { id: 'any', label: 'Plant or insect' },
];

export const POTION_GARDEN_PLANT_FILTER_OPTIONS: ReadonlyArray<{
  id: PotionGardenPlantFilter;
  label: string;
  hint: string;
}> = [
  { id: 'all', label: 'All plants', hint: 'Every planted garden plant' },
  { id: 'role', label: 'By role', hint: 'All shooters, supports, blockers, …' },
  { id: 'plant_ids', label: 'Specific plants', hint: 'Comma-separated plant ids' },
];

export const POTION_GARDEN_ROLE_OPTIONS: ReadonlyArray<{
  id: PlantRole;
  label: string;
}> = PLANT_ROLES.map((id) => ({
  id,
  label: id.replace(/_/g, ' '),
}));

/** @deprecated Prefer target shape options. */
export const POTION_TARGET_MODE_OPTIONS: ReadonlyArray<{
  id: PotionTargetMode;
  label: string;
  hint: string;
}> = [
  { id: 'none', label: 'None', hint: 'Dialog Use only (garden)' },
  { id: 'single', label: 'Single', hint: 'One unit' },
  { id: 'aoe', label: 'AoE', hint: 'Units in range' },
  { id: 'ally_unit', label: 'Ally unit (legacy)', hint: 'Legacy' },
  { id: 'enemy_unit', label: 'Enemy unit (legacy)', hint: 'Legacy' },
  { id: 'ally_aoe', label: 'Ally AoE (legacy)', hint: 'Legacy' },
  { id: 'enemy_aoe', label: 'Enemy AoE (legacy)', hint: 'Legacy' },
];

export const POTION_PRODUCTION_RESOURCE_OPTIONS: ReadonlyArray<{
  id: PotionProductionResource;
  label: string;
}> = [
  { id: 'all', label: 'All resources' },
  { id: 'coin', label: 'Coin' },
  { id: 'gem', label: 'Gem' },
  { id: 'leaf', label: 'Leaf' },
];

/** @deprecated Prefer category options. */
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

export function categoryToScope(category: PotionCategory): PotionEffectScope {
  return category === 'garden' ? 'garden' : 'raid';
}

export function defaultTargetShapeForCategory(
  category: PotionCategory,
): PotionTargetShape {
  return category === 'garden' ? 'none' : 'single';
}

/** @deprecated */
export function defaultTargetModeForCategory(
  category: PotionCategory,
): PotionTargetMode {
  return defaultTargetShapeForCategory(category);
}

export function deriveLegacyTargetMode(effect: Pick<
  PotionEffect,
  'targetShape' | 'battleSide'
>): PotionTargetMode {
  const shape = effect.targetShape ?? 'none';
  if (shape === 'none') return 'none';
  const ally = (effect.battleSide ?? 'ally') === 'ally';
  if (shape === 'aoe') return ally ? 'ally_aoe' : 'enemy_aoe';
  return ally ? 'ally_unit' : 'enemy_unit';
}

export function potionAffectsGardenPlant(
  effect: Pick<
    PotionEffect,
    'gardenPlantFilter' | 'gardenRole' | 'gardenPlantIds'
  > | null | undefined,
  plantId: string,
  plantRole?: string | null,
): boolean {
  if (!effect) return true;
  const filter = effect.gardenPlantFilter ?? 'all';
  if (filter === 'all') return true;
  if (filter === 'role') {
    const role = (effect.gardenRole ?? '').trim();
    if (!role) return true;
    return String(plantRole ?? '').trim() === role;
  }
  if (filter === 'plant_ids') {
    const ids = effect.gardenPlantIds ?? [];
    if (ids.length === 0) return false;
    return ids.some((id) => id === plantId);
  }
  return true;
}

export function defaultPotionEffect(
  kind: PotionEffectKind = 'production_rate',
  category: PotionCategory = 'garden',
): PotionEffect {
  const scope = categoryToScope(category);
  if (category === 'garden') {
    return {
      kind: kind === 'production_rate' ? kind : 'production_rate',
      amount: kind === 'production_rate' ? 50 : 25,
      durationSec: DEFAULT_GARDEN_POTION_DURATION_SEC,
      scope: 'garden',
      targetShape: 'none',
      targetMode: 'none',
      resource: 'all',
      gardenPlantFilter: 'all',
    };
  }

  switch (kind) {
    case 'heal':
      return {
        kind,
        amount: 300,
        durationSec: 0,
        scope: 'raid',
        targetShape: 'single',
        targetMode: 'ally_unit',
        battleSide: 'ally',
        battleUnitKind: 'plant',
      };
    case 'damage':
      return {
        kind,
        amount: 40,
        durationSec: 5,
        rangeCells: 1.5,
        scope: 'raid',
        targetShape: 'aoe',
        targetMode: 'ally_aoe',
        battleSide: 'ally',
        battleUnitKind: 'plant',
      };
    case 'armor':
      return {
        kind,
        amount: 40,
        durationSec: 5,
        rangeCells: 1.5,
        scope: 'raid',
        targetShape: 'aoe',
        targetMode: 'ally_aoe',
        battleSide: 'ally',
        battleUnitKind: 'plant',
      };
    case 'attack_speed':
      return {
        kind,
        amount: 40,
        durationSec: 5,
        scope: 'raid',
        targetShape: 'single',
        targetMode: 'ally_unit',
        battleSide: 'ally',
        battleUnitKind: 'plant',
      };
    case 'move_speed':
      return {
        kind,
        amount: 40,
        durationSec: 5,
        scope: 'raid',
        targetShape: 'single',
        targetMode: 'ally_unit',
        battleSide: 'ally',
        battleUnitKind: 'insect',
      };
    case 'freeze':
      return {
        kind,
        amount: 0,
        durationSec: 3,
        rangeCells: 1.5,
        scope: 'raid',
        targetShape: 'aoe',
        targetMode: 'enemy_aoe',
        battleSide: 'enemy',
        battleUnitKind: 'insect',
      };
    case 'poison':
      return {
        kind,
        amount: 40,
        durationSec: 5,
        scope: 'raid',
        targetShape: 'single',
        targetMode: 'enemy_unit',
        battleSide: 'enemy',
        battleUnitKind: 'insect',
      };
    default:
      return {
        kind,
        amount: 25,
        durationSec: DEFAULT_POTION_DURATION_SEC,
        scope,
        targetShape: 'single',
        targetMode: 'ally_unit',
        battleSide: 'ally',
        battleUnitKind: 'any',
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

function normalizeCategory(
  raw: Partial<PotionDefinition> | null | undefined,
  effectScope?: PotionEffectScope,
): PotionCategory {
  const c = (raw as { category?: string } | null | undefined)?.category;
  if (c === 'garden' || c === 'battle') return c;
  if (effectScope === 'garden') return 'garden';
  if (effectScope === 'raid') return 'battle';
  return 'garden';
}

function normalizeEffect(
  raw: Partial<PotionEffect> | null | undefined,
  category: PotionCategory,
): PotionEffect {
  const kind = (raw?.kind as PotionEffectKind) || 'production_rate';
  const base = defaultPotionEffect(kind, category);
  const amount = Number.isFinite(raw?.amount) ? Number(raw!.amount) : base.amount;
  const durationSec =
    raw?.durationSec != null && Number.isFinite(raw.durationSec)
      ? Math.max(0, Number(raw.durationSec))
      : base.durationSec;
  const rangeCells =
    raw?.rangeCells != null && Number.isFinite(raw.rangeCells)
      ? Math.max(0, Number(raw.rangeCells))
      : base.rangeCells;
  const scope =
    (raw?.scope as PotionEffectScope) ||
    base.scope ||
    categoryToScope(category);

  let targetShape = raw?.targetShape as PotionTargetShape | undefined;
  let battleSide = raw?.battleSide as PotionBattleSide | undefined;
  let battleUnitKind = raw?.battleUnitKind as PotionBattleUnitKind | undefined;
  const legacyMode = raw?.targetMode as PotionTargetMode | undefined;

  if (!targetShape && legacyMode) {
    if (legacyMode === 'ally_aoe' || legacyMode === 'enemy_aoe' || legacyMode === 'aoe') {
      targetShape = 'aoe';
    } else if (
      legacyMode === 'ally_unit' ||
      legacyMode === 'enemy_unit' ||
      legacyMode === 'single'
    ) {
      targetShape = 'single';
    } else if (legacyMode === 'none') {
      targetShape = 'none';
    }
    if (!battleSide) {
      if (legacyMode === 'enemy_unit' || legacyMode === 'enemy_aoe') battleSide = 'enemy';
      else if (legacyMode === 'ally_unit' || legacyMode === 'ally_aoe') battleSide = 'ally';
    }
  }

  targetShape =
    targetShape ||
    base.targetShape ||
    defaultTargetShapeForCategory(category);
  if (category === 'garden') targetShape = 'none';

  battleSide =
    battleSide === 'ally' || battleSide === 'enemy'
      ? battleSide
      : base.battleSide || (category === 'battle' ? 'ally' : undefined);
  battleUnitKind =
    battleUnitKind === 'plant' ||
    battleUnitKind === 'insect' ||
    battleUnitKind === 'any'
      ? battleUnitKind
      : base.battleUnitKind || (category === 'battle' ? 'any' : undefined);

  const resourceRaw = raw?.resource ?? base.resource;
  const resource: PotionProductionResource | undefined =
    resourceRaw === 'coin' ||
    resourceRaw === 'gem' ||
    resourceRaw === 'leaf' ||
    resourceRaw === 'all'
      ? resourceRaw
      : kind === 'production_rate'
        ? 'all'
        : undefined;

  let gardenPlantFilter = raw?.gardenPlantFilter ?? base.gardenPlantFilter;
  if (
    gardenPlantFilter !== 'all' &&
    gardenPlantFilter !== 'role' &&
    gardenPlantFilter !== 'plant_ids'
  ) {
    gardenPlantFilter = category === 'garden' ? 'all' : undefined;
  }
  const gardenRoleRaw = raw?.gardenRole ?? base.gardenRole;
  const gardenRole =
    gardenRoleRaw && PLANT_ROLES.includes(gardenRoleRaw as PlantRole)
      ? (gardenRoleRaw as PlantRole)
      : undefined;
  const gardenPlantIds = Array.isArray(raw?.gardenPlantIds)
    ? raw!.gardenPlantIds!.map((id) => String(id).trim()).filter(Boolean)
    : Array.isArray(base.gardenPlantIds)
      ? [...base.gardenPlantIds]
      : undefined;

  const targetMode =
    deriveLegacyTargetMode({ targetShape, battleSide }) ||
    legacyMode ||
    base.targetMode;

  return {
    kind,
    amount,
    durationSec,
    ...(rangeCells != null ? { rangeCells } : {}),
    scope,
    targetShape,
    targetMode,
    ...(battleSide != null ? { battleSide } : {}),
    ...(battleUnitKind != null ? { battleUnitKind } : {}),
    ...(resource != null ? { resource } : {}),
    ...(gardenPlantFilter != null ? { gardenPlantFilter } : {}),
    ...(gardenRole != null ? { gardenRole } : {}),
    ...(gardenPlantIds != null && gardenPlantIds.length > 0
      ? { gardenPlantIds }
      : {}),
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
  const category = normalizeCategory(raw, raw.effect?.scope);

  return {
    id,
    displayName: raw.displayName?.trim() || folder,
    description: raw.description?.trim() || undefined,
    schemaVersion:
      typeof raw.schemaVersion === 'number'
        ? raw.schemaVersion
        : CURRENT_POTION_SCHEMA_VERSION,
    rarity,
    category,
    effect: normalizeEffect(raw.effect, category),
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
    (partial?.displayName ? toPascal(partial.displayName) : 'GrowthBoost');
  const id = partial?.id && partial.id.length > 0 ? partial.id : toSnake(folder);
  const category: PotionCategory =
    partial?.category === 'battle' || partial?.category === 'garden'
      ? partial.category
      : 'garden';
  const effectKind = (partial?.effect?.kind as PotionEffectKind) || 'production_rate';
  return normalizePotionDefinition({
    ...partial,
    id,
    displayName: partial?.displayName ?? folder,
    category,
    client: {
      ...defaultPotionClientAssets(folder),
      ...partial?.client,
      folder,
    },
    effect: {
      ...defaultPotionEffect(effectKind, category),
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
 * Timed buff written when a garden potion with durationSec &gt; 0 is used.
 * Battle targeted effects are not stored — clients apply them from {@link UsePotionResult.effect}.
 */
export interface ActivePotionBuff {
  potionId: EntityId;
  kind: PotionEffectKind;
  amount: number;
  scope: PotionEffectScope;
  rangeCells?: number;
  resource?: PotionProductionResource;
  gardenPlantFilter?: PotionGardenPlantFilter;
  gardenRole?: PlantRole;
  gardenPlantIds?: EntityId[];
  /** ISO timestamp when the buff started. */
  startedAt: string;
  /** ISO timestamp when the buff ends; null if already expired / unknown. */
  expiresAt: string | null;
}

/** Request body for POST /api/potions/:potionId/use */
export interface UsePotionRequest {
  context: PotionUseContext;
  /** Battle loadout slot index (0–4) when using from the raid tray. */
  slotIndex?: number;
}

/** Response from POST /api/potions/:potionId/use */
export interface UsePotionResult {
  potionId: EntityId;
  /** Remaining owned quantity after consume. */
  quantity: number;
  inventory: UserPotionStack[];
  activeBuffs: ActivePotionBuff[];
  battlePotionSlots: (EntityId | null)[];
  /** Effect applied by this use (for instant heal / client apply). */
  effect: PotionEffect;
}

/** Response from POST /api/potions/:potionId/purchase */
export interface PurchasePotionResult {
  potionId: EntityId;
  quantity: number;
  wallet: WalletResources;
}

/** Request body for PUT /api/potions/loadout */
export interface SetPotionLoadoutRequest {
  /** Exactly {@link BATTLE_POTION_SLOT_COUNT} entries; null/empty clears a slot. */
  slots: Array<EntityId | null | ''>;
}

/** Response from PUT /api/potions/loadout */
export interface SetPotionLoadoutResult {
  battlePotionSlots: (EntityId | null)[];
}

export function emptyBattlePotionSlots(): (EntityId | null)[] {
  return Array.from({ length: BATTLE_POTION_SLOT_COUNT }, () => null);
}

export function normalizeBattlePotionSlots(
  raw: Array<EntityId | null | '' | undefined> | null | undefined,
): (EntityId | null)[] {
  const out = emptyBattlePotionSlots();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < BATTLE_POTION_SLOT_COUNT; i++) {
    const v = raw[i];
    if (v == null || v === '') {
      out[i] = null;
      continue;
    }
    const id = String(v).trim();
    out[i] = id.length > 0 ? id : null;
  }
  return out;
}

export function potionMatchesUseContext(
  potion: Pick<PotionDefinition, 'category'> | PotionEffectScope | undefined,
  context: PotionUseContext,
): boolean {
  if (potion == null) return true;
  if (typeof potion === 'string') {
    if (potion === 'any') return true;
    return potion === context;
  }
  if (potion.category === 'garden') return context === 'garden';
  if (potion.category === 'battle') return context === 'raid';
  return true;
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

/** Sum of active buff amounts for a kind, optionally filtered by garden plant. */
export function sumActivePotionEffect(
  buffs: ActivePotionBuff[] | null | undefined,
  kind: PotionEffectKind,
  nowMs: number = Date.now(),
  resource?: PotionProductionResource,
  plant?: { plantId: string; role?: string | null },
): number {
  const live = pruneExpiredPotionBuffs(buffs, nowMs);
  let total = 0;
  for (const row of live) {
    if (row.kind !== kind) continue;
    if (kind === 'production_rate' && resource && resource !== 'all') {
      const rowRes = row.resource ?? 'all';
      if (rowRes !== 'all' && rowRes !== resource) continue;
    }
    if (plant) {
      if (
        !potionAffectsGardenPlant(
          {
            gardenPlantFilter: row.gardenPlantFilter,
            gardenRole: row.gardenRole,
            gardenPlantIds: row.gardenPlantIds,
          },
          plant.plantId,
          plant.role,
        )
      ) {
        continue;
      }
    }
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
  const resourceRaw = raw.resource;
  const resource: PotionProductionResource | undefined =
    resourceRaw === 'coin' ||
    resourceRaw === 'gem' ||
    resourceRaw === 'leaf' ||
    resourceRaw === 'all'
      ? resourceRaw
      : undefined;
  const gardenPlantFilter =
    raw.gardenPlantFilter === 'all' ||
    raw.gardenPlantFilter === 'role' ||
    raw.gardenPlantFilter === 'plant_ids'
      ? raw.gardenPlantFilter
      : undefined;
  const gardenRole =
    raw.gardenRole && PLANT_ROLES.includes(raw.gardenRole as PlantRole)
      ? (raw.gardenRole as PlantRole)
      : undefined;
  const gardenPlantIds = Array.isArray(raw.gardenPlantIds)
    ? raw.gardenPlantIds.map((id) => String(id).trim()).filter(Boolean)
    : undefined;
  return {
    potionId,
    kind,
    amount,
    scope,
    startedAt,
    expiresAt,
    ...(rangeCells != null ? { rangeCells } : {}),
    ...(resource != null ? { resource } : {}),
    ...(gardenPlantFilter != null ? { gardenPlantFilter } : {}),
    ...(gardenRole != null ? { gardenRole } : {}),
    ...(gardenPlantIds != null && gardenPlantIds.length > 0
      ? { gardenPlantIds }
      : {}),
  };
}
