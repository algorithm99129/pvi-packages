/**
 * Timed treasure boxes — the shop's gamble.
 *
 * A player buys a box, it sits in one of a few slots and counts down (or opens at once when
 * the tier has no timer), then they open it and the server rolls its contents: coins, leaves,
 * a few gems, now and then a potion — or a **card**: a random plant or insect they have not
 * unlocked yet. Gems can skip the wait.
 *
 * Two rules keep this from becoming a money printer:
 *
 * 1. **Every box pays back less than it costs on average.** Each tier's drops are authored
 *    with weights and ranges, and {@link treasureBoxExpectedValue} prices them in coin
 *    (gems and leaves at the shop's exchange rates, potions and cards at their shop price).
 *    Studio shows the return ratio while designing; the shipped in-game tiers return about
 *    75–85% of their price.
 * 2. **A daily treasure budget caps what can be spent on boxes.** Priced in coin value
 *    (a gem box counts at `gemCoinValue` per gem; the clients show it in gems), it resets at UTC midnight and grows with
 *    village level, account level, a team membership and a purchasable treasure licence
 *    ({@link resolveTreasureBudget}). So a box cannot convert unbounded farmed coin into gems,
 *    and the ways to raise the cap are themselves progression and sinks.
 *
 * A tier may instead be priced in **real money** (`priceUsdCents`): it is bought through the
 * shop's payment orders, never touches the daily budget, and is limited per day by its own
 * `dailyLimit`, which the licence raises (`paidBoxesPerLevel`). That is where cards live:
 * the shipped Card Chest is the only place a card can be bought, and it is money only.
 *
 * Authored in Studio (Progression → Treasure boxes) and written to both Resources trees
 * (`Progression/treasure.json`); the server enforces everything, the client only paints.
 */

import type { PotionCategory, PotionDefinition } from './potion';
import type { WalletResources } from './wallet';

export const TREASURE_SCHEMA_VERSION = 1;

export type TreasureDropKind = 'coin' | 'gem' | 'leaf' | 'potion' | 'card' | 'map';

export const TREASURE_DROP_KINDS: readonly TreasureDropKind[] = ['coin', 'gem', 'leaf', 'potion', 'card', 'map'];

export type TreasurePotionCategoryFilter = 'any' | PotionCategory;
export type TreasureRarityFilter = 'any' | PotionDefinition['rarity'];
/** @deprecated Use {@link TreasureRarityFilter}. */
export type TreasurePotionRarityFilter = TreasureRarityFilter;
export type TreasureCardSideFilter = 'any' | 'plant' | 'insect';

export interface TreasureDrop {
  kind: TreasureDropKind;
  /** Inclusive amount range: currency units, or potion / card count. */
  min: number;
  max: number;
  /** Relative chance against the other drops of the same tier. */
  weight: number;
  /** Potion drops: one specific potion, else any potion matching the filters. */
  potionId?: string;
  potionCategory?: TreasurePotionCategoryFilter;
  potionRarity?: TreasureRarityFilter;
  /** Card drops: a random locked plant / insect matching the filters. */
  cardSide?: TreasureCardSideFilter;
  cardRarity?: TreasureRarityFilter;
  /** Map drops unlock a random garden map the player does not own; no filters. */
}

export interface TreasureBoxTier {
  id: string;
  displayName: string;
  description: string;
  /** Client Resources sprite path for the closed box. */
  image: string;
  /** The same box open — shown once it is ready and in the reveal. Falls back to `image`. */
  imageOpen: string;
  /** Hex accent for chips and glows around the art. */
  tint: string;
  priceCoin: number;
  priceGem: number;
  /** Real-money price in US cents; above 0 the tier is money-only (coins and gems are ignored). */
  priceUsdCents: number;
  /** Seconds from purchase until the box can be opened; 0 opens at once. */
  unlockSeconds: number;
  /** Independent draws per box; every draw picks one drop by weight. */
  rolls: number;
  drops: TreasureDrop[];
  /** Purchases of this tier per UTC day; 0 = no limit (the budget still applies to in-game tiers). */
  dailyLimit: number;
  /** Village level needed to buy this tier; 1 asks for nothing. */
  minVillageLevel: number;
}

export interface TreasureLicenceRule {
  /** Gem price of each licence level in order; the array's length is the max level. */
  costGemPerLevel: number[];
  /** Daily budget added per licence level. */
  bonusCoinPerLevel: number;
  /** Extra real-money boxes per day, per licence level, on tiers that have a daily limit. */
  paidBoxesPerLevel: number;
}

export interface TreasureBudgetRule {
  /** Daily budget everyone starts with, in coin value. */
  baseCoin: number;
  /** Added per village level above 1. */
  perVillageLevelCoin: number;
  /** Added per account level above 1. */
  perUserLevelCoin: number;
  /** Added while the player is in a team. */
  teamBonusCoin: number;
  licence: TreasureLicenceRule;
}

export interface TreasureConfig {
  schemaVersion: number;
  /** Coin value of one gem for budget and expected-value maths (the $10 pack rate). */
  gemCoinValue: number;
  /** Coin value of one leaf (`LEAF_GEM_PRICE` gems × gemCoinValue). */
  leafCoinValue: number;
  /** Boxes that can wait at once. */
  slotCount: number;
  /** Gems to skip one hour of waiting; charged pro rata, never below minSkipGem. */
  skipGemPerHour: number;
  minSkipGem: number;
  /**
   * When a card drop finds nothing left to unlock, the player gets this share of the
   * average matching unlock price back in gems (0.5 = half).
   */
  duplicateCardGemShare: number;
  budget: TreasureBudgetRule;
  tiers: TreasureBoxTier[];
}

/** Where the authored config lives, relative to each Resources root. */
export const TREASURE_RESOURCE_PATH = 'Progression/treasure.json';

export const DEFAULT_TREASURE_CHEST_IMAGE = 'Screen/TreasureBox/wood_closed';
export const DEFAULT_TREASURE_CHEST_IMAGE_OPEN = 'Screen/TreasureBox/wood_open';

/** The sliced chest sheet (Screen/TreasureBox/*): six looks, each closed and open. */
export const TREASURE_CHEST_LOOKS = ['wood', 'red', 'silver', 'leaf', 'dark', 'purple'] as const;
export const treasureChestImage = (look: (typeof TREASURE_CHEST_LOOKS)[number], open: boolean) =>
  `Screen/TreasureBox/${look}_${open ? 'open' : 'closed'}`;

/** Shop SKU of a real-money tier: `treasure:<tierId>`; paid through POST /shop/orders. */
export const TREASURE_SKU_PREFIX = 'treasure:';
export const treasureSkuFor = (tierId: string) => `${TREASURE_SKU_PREFIX}${tierId}`;
export const isTreasureSku = (sku: string) => String(sku ?? '').startsWith(TREASURE_SKU_PREFIX);
export const treasureTierIdFromSku = (sku: string) =>
  isTreasureSku(sku) ? String(sku).slice(TREASURE_SKU_PREFIX.length) : null;

export const formatUsdCents = (cents: number) => `$${(Math.max(0, cents) / 100).toFixed(2)}`;

/**
 * The shipped tiers. Return ratios (expected coin value ÷ price) sit at 75–85% with potions
 * and cards valued at their shop price, so a box is a sink with a thrill, never an income.
 * The free daily pouch is the only faucet, and it is worth about a daily-login day. The
 * Card Chest is money only and the one place a card drops.
 */
export const DEFAULT_TREASURE_CONFIG: TreasureConfig = {
  schemaVersion: TREASURE_SCHEMA_VERSION,
  gemCoinValue: 40,
  leafCoinValue: 120,
  slotCount: 3,
  skipGemPerHour: 6,
  minSkipGem: 1,
  duplicateCardGemShare: 0.5,
  budget: {
    baseCoin: 2000,
    perVillageLevelCoin: 250,
    perUserLevelCoin: 40,
    teamBonusCoin: 600,
    licence: {
      costGemPerLevel: [50, 100, 160, 240, 350],
      bonusCoinPerLevel: 1200,
      paidBoxesPerLevel: 1,
    },
  },
  tiers: [
    {
      id: 'seed_pouch',
      displayName: 'Seed Pouch',
      description: 'A free pouch once a day. A few coins, sometimes a leaf or a gem.',
      image: treasureChestImage('leaf', false),
      imageOpen: treasureChestImage('leaf', true),
      tint: '#7ed957',
      priceCoin: 0,
      priceGem: 0,
      priceUsdCents: 0,
      unlockSeconds: 0,
      rolls: 1,
      drops: [
        { kind: 'coin', min: 40, max: 120, weight: 80 },
        { kind: 'leaf', min: 1, max: 1, weight: 15 },
        { kind: 'gem', min: 1, max: 1, weight: 5 },
      ],
      dailyLimit: 1,
      minVillageLevel: 1,
    },
    {
      id: 'wooden_box',
      displayName: 'Wooden Box',
      description: 'Ready in 15 minutes. Coins, with a chance of leaves or a few gems.',
      image: treasureChestImage('wood', false),
      imageOpen: treasureChestImage('wood', true),
      tint: '#b07a3c',
      priceCoin: 0,
      priceGem: 10,
      priceUsdCents: 0,
      unlockSeconds: 15 * 60,
      rolls: 2,
      drops: [
        { kind: 'coin', min: 90, max: 220, weight: 70 },
        { kind: 'leaf', min: 1, max: 2, weight: 22 },
        { kind: 'gem', min: 1, max: 3, weight: 8 },
      ],
      dailyLimit: 0,
      minVillageLevel: 1,
    },
    {
      id: 'bronze_box',
      displayName: 'Bronze Box',
      description: 'Ready in an hour. Three draws: coins, leaves, gems, now and then a garden potion.',
      image: treasureChestImage('red', false),
      imageOpen: treasureChestImage('red', true),
      tint: '#d9823a',
      priceCoin: 0,
      priceGem: 40,
      priceUsdCents: 0,
      unlockSeconds: 60 * 60,
      rolls: 3,
      drops: [
        { kind: 'coin', min: 220, max: 600, weight: 60 },
        { kind: 'leaf', min: 2, max: 5, weight: 25 },
        { kind: 'gem', min: 3, max: 8, weight: 12 },
        { kind: 'potion', min: 1, max: 1, weight: 3, potionCategory: 'garden', potionRarity: 'any' },
      ],
      dailyLimit: 0,
      minVillageLevel: 1,
    },
    {
      id: 'silver_box',
      displayName: 'Silver Box',
      description: 'Ready in four hours. Four draws: gems, potions, now and then a card or a garden map.',
      image: treasureChestImage('silver', false),
      imageOpen: treasureChestImage('silver', true),
      tint: '#cfd8e3',
      priceCoin: 0,
      priceGem: 90,
      priceUsdCents: 0,
      unlockSeconds: 4 * 60 * 60,
      rolls: 4,
      drops: [
        { kind: 'coin', min: 350, max: 900, weight: 52 },
        { kind: 'leaf', min: 3, max: 8, weight: 22 },
        { kind: 'gem', min: 5, max: 14, weight: 16 },
        { kind: 'potion', min: 1, max: 1, weight: 6, potionCategory: 'any', potionRarity: 'any' },
        { kind: 'card', min: 1, max: 1, weight: 1, cardSide: 'any', cardRarity: 'any' },
        { kind: 'map', min: 1, max: 1, weight: 1 },
      ],
      dailyLimit: 0,
      minVillageLevel: 3,
    },
    {
      id: 'golden_box',
      displayName: 'Golden Box',
      description: 'Ready in eight hours. Five draws: the biggest gem pulls, rare potions, cards and garden maps.',
      image: treasureChestImage('purple', false),
      imageOpen: treasureChestImage('purple', true),
      tint: '#ffc93d',
      priceCoin: 0,
      priceGem: 200,
      priceUsdCents: 0,
      unlockSeconds: 8 * 60 * 60,
      rolls: 5,
      drops: [
        { kind: 'coin', min: 600, max: 1600, weight: 46 },
        { kind: 'leaf', min: 5, max: 14, weight: 18 },
        { kind: 'gem', min: 10, max: 30, weight: 20 },
        { kind: 'potion', min: 1, max: 1, weight: 8, potionCategory: 'any', potionRarity: 'rare' },
        { kind: 'card', min: 1, max: 1, weight: 3, cardSide: 'any', cardRarity: 'any' },
        { kind: 'map', min: 1, max: 1, weight: 2 },
      ],
      dailyLimit: 0,
      minVillageLevel: 5,
    },
    {
      id: 'collectors_chest',
      displayName: 'Card Chest',
      description: 'Opens at once. A random plant or insect card you do not own yet, plus gems and leaves. Three a day, more with the licence.',
      image: treasureChestImage('dark', false),
      imageOpen: treasureChestImage('dark', true),
      tint: '#a855f7',
      priceCoin: 0,
      priceGem: 0,
      priceUsdCents: 299,
      unlockSeconds: 0,
      rolls: 3,
      drops: [
        { kind: 'card', min: 1, max: 1, weight: 50, cardSide: 'any', cardRarity: 'any' },
        { kind: 'gem', min: 10, max: 30, weight: 30 },
        { kind: 'leaf', min: 5, max: 15, weight: 20 },
      ],
      dailyLimit: 3,
      minVillageLevel: 1,
    },
  ],
};

/* ------------------------------------------------------------------ normalize */

const int = (value: unknown, fallback: number, min = 0): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
};

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const RARITY_FILTERS: readonly TreasureRarityFilter[] = [
  'any',
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

const rarityFilter = (value: unknown, fallback: TreasureRarityFilter = 'any'): TreasureRarityFilter =>
  (RARITY_FILTERS as readonly string[]).includes(String(value)) ? (value as TreasureRarityFilter) : fallback;

export function normalizeTreasureDrop(raw: unknown, fallback?: TreasureDrop): TreasureDrop | null {
  const r = (raw ?? {}) as Partial<TreasureDrop>;
  const kind = (TREASURE_DROP_KINDS as readonly string[]).includes(String(r.kind))
    ? (r.kind as TreasureDropKind)
    : fallback?.kind;
  if (!kind) return null;
  const min = int(r.min, fallback?.min ?? 1, 0);
  const max = Math.max(min, int(r.max, fallback?.max ?? min, 0));
  const drop: TreasureDrop = {
    kind,
    min,
    max,
    weight: int(r.weight, fallback?.weight ?? 1, 0),
  };
  if (kind === 'potion') {
    const id = str(r.potionId, '');
    if (id) drop.potionId = id;
    const category = String(r.potionCategory ?? fallback?.potionCategory ?? 'any');
    drop.potionCategory =
      category === 'garden' || category === 'battle' ? category : 'any';
    drop.potionRarity = rarityFilter(r.potionRarity ?? fallback?.potionRarity);
  }
  if (kind === 'card') {
    const side = String(r.cardSide ?? fallback?.cardSide ?? 'any');
    drop.cardSide = side === 'plant' || side === 'insect' ? side : 'any';
    drop.cardRarity = rarityFilter(r.cardRarity ?? fallback?.cardRarity);
  }
  return drop;
}

export function normalizeTreasureTier(raw: unknown, fallback?: TreasureBoxTier): TreasureBoxTier | null {
  const r = (raw ?? {}) as Partial<TreasureBoxTier>;
  const id = str(r.id, fallback?.id ?? '');
  if (!id) return null;
  const drops = (Array.isArray(r.drops) ? r.drops : fallback?.drops ?? [])
    .map((d) => normalizeTreasureDrop(d))
    .filter((d): d is TreasureDrop => Boolean(d));
  const image = str(r.image, fallback?.image ?? DEFAULT_TREASURE_CHEST_IMAGE);
  return {
    id,
    displayName: str(r.displayName, fallback?.displayName ?? id),
    description: typeof r.description === 'string' ? r.description : fallback?.description ?? '',
    image,
    imageOpen: str(r.imageOpen, fallback?.imageOpen ?? (r.image ? image : DEFAULT_TREASURE_CHEST_IMAGE_OPEN)),
    tint: str(r.tint, fallback?.tint ?? '#ffc93d'),
    priceCoin: int(r.priceCoin, fallback?.priceCoin ?? 0),
    priceGem: int(r.priceGem, fallback?.priceGem ?? 0),
    priceUsdCents: int(r.priceUsdCents, fallback?.priceUsdCents ?? 0),
    unlockSeconds: int(r.unlockSeconds, fallback?.unlockSeconds ?? 0),
    rolls: int(r.rolls, fallback?.rolls ?? 1, 1),
    drops,
    dailyLimit: int(r.dailyLimit, fallback?.dailyLimit ?? 0),
    minVillageLevel: int(r.minVillageLevel, fallback?.minVillageLevel ?? 1, 1),
  };
}

/** A whole config; gaps take the shipped defaults, unknown tiers are kept as authored. */
export function normalizeTreasureConfig(raw: unknown): TreasureConfig {
  const r = (raw ?? {}) as Partial<TreasureConfig>;
  const d = DEFAULT_TREASURE_CONFIG;
  const b = (r.budget ?? {}) as Partial<TreasureBudgetRule>;
  const l = (b.licence ?? {}) as Partial<TreasureLicenceRule>;
  const costs = Array.isArray(l.costGemPerLevel)
    ? l.costGemPerLevel.map((c) => int(c, 0)).filter((c) => c > 0)
    : [...d.budget.licence.costGemPerLevel];
  const tiers = (Array.isArray(r.tiers) ? r.tiers : d.tiers)
    .map((t) => normalizeTreasureTier(t))
    .filter((t): t is TreasureBoxTier => Boolean(t));
  const share = Number(r.duplicateCardGemShare);
  return {
    schemaVersion: TREASURE_SCHEMA_VERSION,
    gemCoinValue: int(r.gemCoinValue, d.gemCoinValue, 1),
    leafCoinValue: int(r.leafCoinValue, d.leafCoinValue, 1),
    slotCount: Math.min(6, int(r.slotCount, d.slotCount, 1)),
    skipGemPerHour: int(r.skipGemPerHour, d.skipGemPerHour, 0),
    minSkipGem: int(r.minSkipGem, d.minSkipGem, 0),
    duplicateCardGemShare: Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : d.duplicateCardGemShare,
    budget: {
      baseCoin: int(b.baseCoin, d.budget.baseCoin),
      perVillageLevelCoin: int(b.perVillageLevelCoin, d.budget.perVillageLevelCoin),
      perUserLevelCoin: int(b.perUserLevelCoin, d.budget.perUserLevelCoin),
      teamBonusCoin: int(b.teamBonusCoin, d.budget.teamBonusCoin),
      licence: {
        costGemPerLevel: costs,
        bonusCoinPerLevel: int(l.bonusCoinPerLevel, d.budget.licence.bonusCoinPerLevel),
        paidBoxesPerLevel: int(l.paidBoxesPerLevel, d.budget.licence.paidBoxesPerLevel),
      },
    },
    tiers: tiers.length > 0 ? tiers : d.tiers.map((t) => normalizeTreasureTier(t)!),
  };
}

/* ------------------------------------------------------------------ pricing */

/** Is this tier bought with real money (through a shop order) rather than coins / gems? */
export const isPaidTreasureTier = (tier: Pick<TreasureBoxTier, 'priceUsdCents'>) => tier.priceUsdCents > 0;

/**
 * A tier's price in coin value: coins, plus gems at the config's exchange rate. A real-money
 * tier is valued at the gem pack rate ($10 = `gemsPerTenUsd` gems) so Studio can still show
 * its return; it never counts against the daily budget.
 */
export function treasureTierPriceCoinValue(
  tier: TreasureBoxTier,
  config: TreasureConfig,
  gemsPerTenUsd = 1200,
): number {
  if (isPaidTreasureTier(tier)) {
    return Math.round((tier.priceUsdCents / 1000) * gemsPerTenUsd * config.gemCoinValue);
  }
  return Math.max(0, tier.priceCoin) + Math.max(0, tier.priceGem) * config.gemCoinValue;
}

/** What a potion is worth in coin: its full shop price at the config's exchange rates. */
export function treasurePotionCoinValue(
  potion: Pick<PotionDefinition, 'server'> | null | undefined,
  config: TreasureConfig,
): number {
  if (!potion?.server) return 0;
  return (
    Math.max(0, potion.server.shopPriceCoin ?? 0)
    + Math.max(0, potion.server.shopPriceGem ?? 0) * config.gemCoinValue
    + Math.max(0, potion.server.shopPriceLeaf ?? 0) * config.leafCoinValue
  );
}

export interface TreasurePotionCandidate {
  id: string;
  category: PotionCategory;
  rarity: PotionDefinition['rarity'];
  /** Coin value for expected-value maths and for the stack-full refund. */
  coinValue: number;
}

/** A plant or insect a card drop may unlock. The server passes only the player's locked ones. */
export interface TreasureCardCandidate {
  id: string;
  kind: 'plant' | 'insect';
  rarity: PotionDefinition['rarity'];
  displayName: string;
  /** Its gem unlock price. */
  unlockGemCost: number;
}

/** A garden map a map drop may unlock. The server passes only the player's unowned ones. */
export interface TreasureMapCandidate {
  id: string;
  displayName: string;
  /** Its shop price in coin value. */
  coinValue: number;
}

export function potionMatchesTreasureDrop(
  potion: Pick<TreasurePotionCandidate, 'id' | 'category' | 'rarity'>,
  drop: TreasureDrop,
): boolean {
  if (drop.kind !== 'potion') return false;
  if (drop.potionId) return potion.id === drop.potionId;
  if (drop.potionCategory && drop.potionCategory !== 'any' && potion.category !== drop.potionCategory) {
    return false;
  }
  if (drop.potionRarity && drop.potionRarity !== 'any' && potion.rarity !== drop.potionRarity) {
    return false;
  }
  return true;
}

export function cardMatchesTreasureDrop(
  card: Pick<TreasureCardCandidate, 'kind' | 'rarity'>,
  drop: TreasureDrop,
): boolean {
  if (drop.kind !== 'card') return false;
  if (drop.cardSide && drop.cardSide !== 'any' && card.kind !== drop.cardSide) return false;
  if (drop.cardRarity && drop.cardRarity !== 'any' && card.rarity !== drop.cardRarity) return false;
  return true;
}

export interface TreasureExpectedValue {
  coin: number;
  gem: number;
  leaf: number;
  potions: number;
  cards: number;
  maps: number;
  /** Everything above priced in coin. */
  coinValue: number;
  priceCoinValue: number;
  /** coinValue ÷ price; above 1 the box pays for itself on average. Infinity when free. */
  returnRatio: number;
}

/**
 * Average contents of one box, priced in coin. Potion and card drops take the mean value of
 * what they can roll; a filter that matches nothing counts as zero.
 */
export function treasureBoxExpectedValue(
  tier: TreasureBoxTier,
  config: TreasureConfig,
  potions: readonly TreasurePotionCandidate[] = [],
  cards: readonly TreasureCardCandidate[] = [],
  maps: readonly TreasureMapCandidate[] = [],
): TreasureExpectedValue {
  const totalWeight = tier.drops.reduce((sum, d) => sum + Math.max(0, d.weight), 0);
  const ev: TreasureExpectedValue = {
    coin: 0,
    gem: 0,
    leaf: 0,
    potions: 0,
    cards: 0,
    maps: 0,
    coinValue: 0,
    priceCoinValue: treasureTierPriceCoinValue(tier, config),
    returnRatio: 0,
  };
  if (totalWeight <= 0 || tier.rolls <= 0) return ev;
  for (const drop of tier.drops) {
    const p = (Math.max(0, drop.weight) / totalWeight) * tier.rolls;
    const mean = (drop.min + drop.max) / 2;
    switch (drop.kind) {
      case 'coin':
        ev.coin += p * mean;
        break;
      case 'gem':
        ev.gem += p * mean;
        break;
      case 'leaf':
        ev.leaf += p * mean;
        break;
      case 'potion': {
        const pool = potions.filter((c) => potionMatchesTreasureDrop(c, drop));
        const value = pool.length
          ? pool.reduce((s, c) => s + c.coinValue, 0) / pool.length
          : 0;
        ev.potions += p * mean;
        ev.coinValue += p * mean * value;
        break;
      }
      case 'card': {
        const pool = cards.filter((c) => cardMatchesTreasureDrop(c, drop));
        const value = pool.length
          ? (pool.reduce((s, c) => s + c.unlockGemCost, 0) / pool.length) * config.gemCoinValue
          : 0;
        ev.cards += p * mean;
        ev.coinValue += p * mean * value;
        break;
      }
      case 'map': {
        const value = maps.length ? maps.reduce((s, m) => s + m.coinValue, 0) / maps.length : 0;
        ev.maps += p * mean;
        ev.coinValue += p * mean * value;
        break;
      }
      default:
        break;
    }
  }
  ev.coinValue += ev.coin + ev.gem * config.gemCoinValue + ev.leaf * config.leafCoinValue;
  ev.returnRatio = ev.priceCoinValue > 0 ? ev.coinValue / ev.priceCoinValue : Number.POSITIVE_INFINITY;
  return ev;
}

/* ------------------------------------------------------------------ budget */

export interface TreasureBudgetInput {
  villageLevel: number;
  userLevel: number;
  inTeam: boolean;
  licenceLevel: number;
}

export interface TreasureBudgetParts {
  base: number;
  village: number;
  userLevel: number;
  team: number;
  licence: number;
}

export interface TreasureBudgetCap {
  cap: number;
  parts: TreasureBudgetParts;
}

/** Today's spending cap for this player, and where each part of it comes from. */
export function resolveTreasureBudget(config: TreasureConfig, input: TreasureBudgetInput): TreasureBudgetCap {
  const rule = config.budget;
  const licenceLevel = Math.max(0, Math.min(treasureLicenceMaxLevel(config), Math.floor(input.licenceLevel || 0)));
  const parts: TreasureBudgetParts = {
    base: rule.baseCoin,
    village: Math.max(0, Math.floor(input.villageLevel || 1) - 1) * rule.perVillageLevelCoin,
    userLevel: Math.max(0, Math.floor(input.userLevel || 1) - 1) * rule.perUserLevelCoin,
    team: input.inTeam ? rule.teamBonusCoin : 0,
    licence: licenceLevel * rule.licence.bonusCoinPerLevel,
  };
  return {
    cap: parts.base + parts.village + parts.userLevel + parts.team + parts.licence,
    parts,
  };
}

/** A tier's purchases allowed per day for this player; 0 = unlimited. The licence raises paid tiers. */
export function treasureTierDailyLimit(tier: TreasureBoxTier, config: TreasureConfig, licenceLevel: number): number {
  if (tier.dailyLimit <= 0) return 0;
  if (!isPaidTreasureTier(tier)) return tier.dailyLimit;
  const level = Math.max(0, Math.min(treasureLicenceMaxLevel(config), Math.floor(licenceLevel || 0)));
  return tier.dailyLimit + level * config.budget.licence.paidBoxesPerLevel;
}

export function treasureLicenceMaxLevel(config: TreasureConfig): number {
  return config.budget.licence.costGemPerLevel.length;
}

/** Gems for the next licence level, or null at the top. */
export function treasureLicenceNextCost(config: TreasureConfig, currentLevel: number): number | null {
  const level = Math.max(0, Math.floor(currentLevel || 0));
  const costs = config.budget.licence.costGemPerLevel;
  return level < costs.length ? costs[level] : null;
}

/** Gems to open a box now instead of in `remainingSeconds`. */
export function treasureSkipGemCost(config: TreasureConfig, remainingSeconds: number): number {
  const remaining = Math.max(0, remainingSeconds);
  if (remaining <= 0) return 0;
  const raw = Math.ceil((remaining / 3600) * config.skipGemPerHour);
  return Math.max(config.minSkipGem, raw);
}

/* ------------------------------------------------------------------ rolling */

export interface TreasureRoll {
  kind: TreasureDropKind;
  amount: number;
  potionId?: string;
  /** Card rolls: the unit to unlock. */
  cardId?: string;
  cardKind?: 'plant' | 'insect';
  /** Map rolls: the garden map to unlock. */
  mapId?: string;
  /** A card or map roll with nothing left to unlock: paid in currency instead. */
  duplicateOf?: TreasureDrop;
}

/**
 * One box's contents: `rolls` weighted picks with uniform amounts. A potion drop with no
 * matching potion in the pool comes out as coin worth the drop's share of the price, so an
 * authoring mistake never silently shrinks a box. A card drop with nothing left to unlock
 * comes out as gems (`duplicateCardGemShare` of the matching catalog's average price): the
 * caller passes `cards` as the player's *locked* units and `allCards` as the whole catalog.
 * A map drop works the same way with `maps` (unowned) and `allMaps`, refunding coins.
 * `random` must return [0, 1).
 */
export function rollTreasureBox(
  tier: TreasureBoxTier,
  config: TreasureConfig,
  potions: readonly TreasurePotionCandidate[],
  random: () => number = Math.random,
  cards: readonly TreasureCardCandidate[] = [],
  allCards: readonly TreasureCardCandidate[] = cards,
  maps: readonly TreasureMapCandidate[] = [],
  allMaps: readonly TreasureMapCandidate[] = maps,
): TreasureRoll[] {
  const weighted = tier.drops.filter((d) => d.weight > 0);
  const totalWeight = weighted.reduce((s, d) => s + d.weight, 0);
  const out: TreasureRoll[] = [];
  if (totalWeight <= 0) return out;
  const price = treasureTierPriceCoinValue(tier, config);
  // A card or map can only be won once per box: ones already rolled leave the pool.
  const locked = [...cards];
  const unowned = [...maps];
  for (let i = 0; i < Math.max(1, tier.rolls); i++) {
    let pick = random() * totalWeight;
    let drop = weighted[weighted.length - 1];
    for (const d of weighted) {
      pick -= d.weight;
      if (pick < 0) {
        drop = d;
        break;
      }
    }
    const amount = drop.min + Math.floor(random() * (drop.max - drop.min + 1));
    if (drop.kind === 'potion') {
      const pool = potions.filter((c) => potionMatchesTreasureDrop(c, drop));
      if (pool.length === 0) {
        out.push({ kind: 'coin', amount: Math.max(1, Math.round((price / Math.max(1, tier.rolls)) * 0.6)) });
        continue;
      }
      const chosen = pool[Math.floor(random() * pool.length)];
      out.push({ kind: 'potion', amount: Math.max(1, amount), potionId: chosen.id });
      continue;
    }
    if (drop.kind === 'card') {
      for (let n = 0; n < Math.max(1, amount); n++) {
        const pool = locked.filter((c) => cardMatchesTreasureDrop(c, drop));
        if (pool.length === 0) {
          const catalog = allCards.filter((c) => cardMatchesTreasureDrop(c, drop));
          const avg = catalog.length ? catalog.reduce((s, c) => s + c.unlockGemCost, 0) / catalog.length : 0;
          const gems = Math.max(1, Math.round(avg * config.duplicateCardGemShare));
          out.push({ kind: 'gem', amount: gems, duplicateOf: drop });
          continue;
        }
        const chosen = pool[Math.floor(random() * pool.length)];
        locked.splice(locked.indexOf(chosen), 1);
        out.push({ kind: 'card', amount: 1, cardId: chosen.id, cardKind: chosen.kind });
      }
      continue;
    }
    if (drop.kind === 'map') {
      for (let n = 0; n < Math.max(1, amount); n++) {
        if (unowned.length === 0) {
          const avg = allMaps.length ? allMaps.reduce((s, m) => s + m.coinValue, 0) / allMaps.length : 0;
          out.push({ kind: 'coin', amount: Math.max(1, Math.round(avg * config.duplicateCardGemShare)), duplicateOf: drop });
          continue;
        }
        const chosen = unowned[Math.floor(random() * unowned.length)];
        unowned.splice(unowned.indexOf(chosen), 1);
        out.push({ kind: 'map', amount: 1, mapId: chosen.id });
      }
      continue;
    }
    out.push({ kind: drop.kind, amount: Math.max(0, amount) });
  }
  return out;
}

/* ------------------------------------------------------------------ views (API) */

export interface TreasureConfigView {
  gemCoinValue: number;
  leafCoinValue: number;
  slotCount: number;
  skipGemPerHour: number;
  minSkipGem: number;
}

/** A tier as the player sees it: the authored row plus what it means for them today. */
export interface TreasureTierView extends TreasureBoxTier {
  priceCoinValue: number;
  /** Real-money tiers: the shop SKU for POST /shop/orders and a display price ("$4.99"). */
  sku: string | null;
  priceLabel: string;
  /** Today's allowance for this tier after the licence; 0 = unlimited. */
  dailyAllowance: number;
  boughtToday: number;
  /** False with a reason when this player cannot buy it right now. */
  canBuy: boolean;
  blockedReason: string | null;
}

export interface TreasureSlotView {
  index: number;
  /** Null when the slot is empty. */
  tierId: string | null;
  startedAt: string | null;
  readyAt: string | null;
  remainingSeconds: number;
  ready: boolean;
  /** Gems to open it now; 0 once ready. */
  skipGem: number;
}

export interface TreasureBudgetView extends TreasureBudgetCap {
  spentToday: number;
  remaining: number;
  /** UTC midnight, when the budget and daily limits reset. */
  resetsAt: string;
  villageLevel: number;
  userLevel: number;
  inTeam: boolean;
}

export interface TreasureLicenceView {
  level: number;
  maxLevel: number;
  /** Gems for the next level; 0 at the top level. */
  nextCostGem: number;
  bonusCoinPerLevel: number;
  paidBoxesPerLevel: number;
}

/** GET /treasure — everything the shop needs to paint. */
export interface TreasureStateView {
  serverTime: string;
  config: TreasureConfigView;
  tiers: TreasureTierView[];
  slots: TreasureSlotView[];
  budget: TreasureBudgetView;
  licence: TreasureLicenceView;
  wallet: WalletResources;
  /** Boxes opened over the account's life. */
  totalOpened: number;
  /** Payment provider's public project id for real-money tiers; null when payments are off. */
  paymentProjectId: string | null;
}

/** One thing a box gave, after merging equal rolls. */
export interface TreasureGrant {
  kind: TreasureDropKind;
  amount: number;
  potionId?: string;
  potionName?: string;
  /** Set when a potion stack was full and coins were paid instead. */
  insteadOfPotionId?: string;
  /** Card grants: the unit that was unlocked. */
  cardId?: string;
  cardKind?: 'plant' | 'insect';
  cardName?: string;
  /** Map grants: the garden map that was unlocked. */
  mapId?: string;
  mapName?: string;
  /** Gems paid because every matching card was already owned. */
  duplicateCard?: boolean;
  /** Coins paid because every garden map was already owned. */
  duplicateMap?: boolean;
}

/** POST /treasure/buy */
export interface TreasureBuyRequest {
  /** Catalog tier id from GET /treasure (e.g. `seed_pouch`, `wooden_box`). */
  tierId?: string;
  /** Alias for {@link tierId}. */
  boxId?: string;
}

export interface TreasureBuyResult {
  tierId: string;
  slotIndex: number;
  /** True when the tier has no timer and the box opened right away; `grants` then holds its contents. */
  opened: boolean;
  grants: TreasureGrant[];
  state: TreasureStateView;
}

/** POST /treasure/open and /treasure/skip */
export interface TreasureSlotRequest {
  slotIndex: number;
}

export interface TreasureOpenResult {
  tierId: string;
  slotIndex: number;
  /** Gems the skip cost; 0 for a box that was ready. */
  skipGemPaid: number;
  grants: TreasureGrant[];
  state: TreasureStateView;
}

/** POST /treasure/licence */
export interface TreasureLicenceResult {
  level: number;
  gemPaid: number;
  state: TreasureStateView;
}

/** Equal rolls merged for display: coins into one line, each potion and each card its own. */
export function mergeTreasureRolls(rolls: readonly TreasureRoll[]): TreasureGrant[] {
  const out: TreasureGrant[] = [];
  for (const roll of rolls) {
    if (roll.kind === 'card') {
      out.push({ kind: 'card', amount: 1, cardId: roll.cardId, cardKind: roll.cardKind });
      continue;
    }
    if (roll.kind === 'map') {
      out.push({ kind: 'map', amount: 1, mapId: roll.mapId });
      continue;
    }
    const dupCard = roll.duplicateOf?.kind === 'card';
    const dupMap = roll.duplicateOf?.kind === 'map';
    const existing = out.find(
      (g) =>
        g.kind === roll.kind
        && (g.potionId ?? '') === (roll.potionId ?? '')
        && Boolean(g.duplicateCard) === dupCard
        && Boolean(g.duplicateMap) === dupMap,
    );
    if (existing) existing.amount += roll.amount;
    else {
      out.push({
        kind: roll.kind,
        amount: roll.amount,
        ...(roll.potionId ? { potionId: roll.potionId } : {}),
        ...(dupCard ? { duplicateCard: true } : {}),
        ...(dupMap ? { duplicateMap: true } : {}),
      });
    }
  }
  return out;
}

export function formatTreasureDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s === 0) return 'Instant';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}
