import type { WalletResources } from './wallet';

/** Resource shop SKUs (IAP stubs + gem sinks). */
export const SHOP_SKU_COIN_PACK = 'coin_pack_s';
export const SHOP_SKU_GEM_PACK_10 = 'gem_pack_10';
export const SHOP_SKU_LEAF_FOR_GEMS = 'leaf_for_gems';
export const SHOP_SKU_STARTER_PACK = 'starter_pack';

/** Leaves granted per `leaf_for_gems` purchase (cost = amount × LEAF_GEM_PRICE). */
export const SHOP_LEAF_PACK_AMOUNT = 10;

/** Soft-currency coin pack size for the $1.99 stub SKU. */
export const SHOP_COIN_PACK_AMOUNT = 10_000;

/** Starter pack contents. One per account: a first-purchase deal, not a repeatable pack. */
export const SHOP_STARTER_PACK_GRANT: WalletResources = {
  coin: 20_000,
  gem: 250,
  leaf: 200,
};

/**
 * The gem ladder. Calibrated against what gems buy here, not against other stores: maxing the
 * game costs about 118,000 gems (8,800 of them the 46 roster unlocks, the rest upgrades gated
 * by account level), and the design goal is "maxing ≈ $1,000". So the rate is nearly flat
 * (1.00¢ → 0.80¢ per gem, a 20% volume bonus at most) and the first-purchase double applies
 * only to the three small tiers, the ones that turn a non-payer into a payer; the big tiers get
 * +25% once. See docs/GEM_LADDER_CALIBRATION_2026-10-12.md. `gem_pack_10` is the anchor at
 * Clash of Clans' rate (1,200 for $9.99); its count follows `GEM_PACK_10_USD` in logic.json.
 */
export interface GemPackDef {
  sku: string;
  priceCents: number;
  gems: number;
  /** Store badge: the tier most people buy, or the best per-gem value. */
  tag: 'popular' | 'best' | null;
  /** Extra gems on this account's first purchase of the tier, in percent (100 = doubled). */
  firstBuyBonusPercent: number;
}

export const SHOP_GEM_PACKS: readonly GemPackDef[] = [
  { sku: 'gem_pack_2', priceCents: 199, gems: 200, tag: null, firstBuyBonusPercent: 100 },
  { sku: 'gem_pack_5', priceCents: 499, gems: 520, tag: null, firstBuyBonusPercent: 100 },
  { sku: SHOP_SKU_GEM_PACK_10, priceCents: 999, gems: 1200, tag: 'popular', firstBuyBonusPercent: 100 },
  { sku: 'gem_pack_20', priceCents: 1999, gems: 2450, tag: null, firstBuyBonusPercent: 25 },
  { sku: 'gem_pack_50', priceCents: 4999, gems: 6250, tag: 'best', firstBuyBonusPercent: 25 },
  { sku: 'gem_pack_100', priceCents: 9999, gems: 12_500, tag: null, firstBuyBonusPercent: 25 },
];

export function gemPackBySku(sku: string): GemPackDef | null {
  return SHOP_GEM_PACKS.find((p) => p.sku === sku) ?? null;
}

export function isGemPackSku(sku: string): boolean {
  return gemPackBySku(String(sku ?? '').trim()) != null;
}

/**
 * The largest first-purchase bonus on the ladder (the small tiers' double). Per tier it is
 * `GemPackDef.firstBuyBonusPercent`; it fires once per SKU per account. Coin and starter packs
 * carry no first-purchase bonus.
 */
export const SHOP_FIRST_PURCHASE_BONUS_PERCENT = Math.max(...SHOP_GEM_PACKS.map((p) => p.firstBuyBonusPercent));

/** The gems a first purchase of a tier grants (its bonus applied, rounded down). */
export function gemPackFirstBuyGems(pack: Pick<GemPackDef, 'gems' | 'firstBuyBonusPercent'>): number {
  return Math.floor(pack.gems * (1 + Math.max(0, pack.firstBuyBonusPercent) / 100));
}

/** Display name of a paid SKU, for order titles and Studio. */
export function shopSkuLabel(sku: string): string {
  const pack = gemPackBySku(sku);
  if (pack) return `${pack.gems.toLocaleString('en-US')} gems`;
  switch (sku) {
    case SHOP_SKU_COIN_PACK:
      return 'Coin pack';
    case SHOP_SKU_STARTER_PACK:
      return 'Starter pack';
    default:
      return sku;
  }
}

/**
 * What a gem is worth in money at the anchor pack's rate, as cents per 100 gems (83 at 1,200
 * for $9.99). Shown beside every gem price: the EU's 2025 virtual-currency principles and the
 * FTC's Genshin order both ask for the real-money cost to be visible, and it is cheap to show
 * now and expensive to retrofit.
 */
export function gemCentsPerHundred(anchorGems: number): number {
  const anchor = gemPackBySku(SHOP_SKU_GEM_PACK_10);
  const gems = Math.max(1, Math.floor(anchorGems) || anchor?.gems || 1200);
  return Math.round(((anchor?.priceCents ?? 999) / gems) * 100);
}

/** "≈ $0.75" for a gem amount at the catalog's rate; empty when the amount is 0. */
export function formatGemUsd(gems: number, centsPerHundred: number): string {
  if (!(gems > 0) || !(centsPerHundred > 0)) return '';
  const cents = (gems * centsPerHundred) / 100;
  return cents < 100 ? `≈ $${(cents / 100).toFixed(2)}` : `≈ $${(cents / 100).toFixed(cents >= 10_000 ? 0 : 2)}`;
}

/** One rung of the gem ladder as the catalog lists it. */
export interface GemPackOffer extends GemPackDef {
  /** "$9.99". */
  priceLabel: string;
  /**
   * True when the asking account has not bought this tier yet, so the first-purchase bonus
   * applies (also true for an anonymous catalog read: a new account would get it).
   */
  firstPurchaseDouble: boolean;
}

export interface BuyResourceOffer {
  sku: string;
  amount: number;
  /** Localized / display price, e.g. "$10.00" or "30 Gems". */
  priceLabel: string;
  /** When set, this offer spends gems instead of real-money IAP. */
  priceGem?: number;
}

export interface StarterPackOffer {
  sku: string;
  coin: number;
  gem: number;
  leaf: number;
  priceLabel: string;
  /** False once this account has bought it (one per account). True for an anonymous read. */
  available: boolean;
}

/**
 * GET /shop/resources. Public; with a JWT the per-account flags (`firstPurchaseDouble`,
 * `starterPack.available`) are filled in for that account.
 */
export interface BuyResourceCatalog {
  coin: BuyResourceOffer;
  /** The anchor gem pack, kept for clients that show one gem offer. */
  gem: BuyResourceOffer;
  leaf: BuyResourceOffer;
  starterPack: StarterPackOffer;
  /** The whole gem ladder, smallest first; each rung carries its own `firstBuyBonusPercent`. */
  gemPacks: GemPackOffer[];
  /** The largest first-purchase bonus on the ladder, for headline copy ("doubled"). */
  firstPurchaseBonusPercent: number;
  /** Cents per 100 gems at the anchor rate, for "≈ $" beside gem prices. */
  gemCentsPerHundred: number;
  /** Gems charged per leaf (`LEAF_GEM_PRICE` from logic.json). */
  leafGemPrice: number;
  /** Gems in the anchor pack (`GEM_PACK_10_USD`). */
  gemPack10Amount: number;
  /**
   * Crypto payment provider's public project id for the checkout widget, or null when
   * crypto payments are not configured on this server.
   */
  paymentProjectId: string | null;
  /** True when card payments (Stripe Checkout) are configured on this server. */
  cardPaymentsEnabled: boolean;
  /**
   * Extra currency a crypto payment grants, in percent (`CRYPTO_PAY_BONUS_PERCENT`): a 1,200
   * gem pack paid in crypto at 10% grants 1,320. Card payments grant the listed amount.
   */
  cryptoBonusPercent: number;
}

/**
 * How a paid order is settled: crypto through CryptumPay, card through Stripe Checkout, or
 * `choose` — not decided yet: the pay page offers both and the player picks there (what the
 * game asks for, since it has one Pay button).
 */
export type ShopPaymentMethod = 'crypto' | 'card' | 'choose';

/** A grant with the crypto bonus applied (rounded down). */
export function applyCryptoBonus(grant: WalletResources, bonusPercent: number): WalletResources {
  const k = 1 + Math.max(0, bonusPercent) / 100;
  return {
    coin: Math.floor(grant.coin * k),
    gem: Math.floor(grant.gem * k),
    leaf: Math.floor(grant.leaf * k),
  };
}

/** USD price of each real-money SKU, in cents. The catalog's priceLabel is derived from it. */
export const SHOP_SKU_PRICE_CENTS: Readonly<Record<string, number>> = {
  [SHOP_SKU_COIN_PACK]: 199,
  [SHOP_SKU_STARTER_PACK]: 499,
  ...Object.fromEntries(SHOP_GEM_PACKS.map((p) => [p.sku, p.priceCents])),
};

/** Is this SKU paid with real money (a payment order) rather than gems? */
export function isPaidShopSku(sku: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHOP_SKU_PRICE_CENTS, String(sku ?? '').trim());
}

/** POST /shop/purchase — gem-priced SKUs only; paid SKUs go through POST /shop/orders. */
export interface ShopPurchaseRequest {
  sku: string;
}

export interface ShopPurchaseResult {
  sku: string;
  wallet: WalletResources;
}

/** Lifecycle of a real-money purchase. Credited once, by the provider's webhook. */
export type ShopOrderStatus = 'pending' | 'paid' | 'expired' | 'failed';

/** Payment provider that took the money; `pending` until the player picks a method. */
export type ShopPaymentProvider = 'cryptumpay' | 'stripe' | 'pending';

/** POST /shop/orders */
export interface ShopOrderCreateRequest {
  sku: string;
  /** Where the pay page sends the player afterwards: 'web' (default), 'webgl' or 'android'. */
  platform?: 'web' | 'webgl' | 'android';
  /** 'crypto' (earns the bonus), 'card', or 'choose' (default): decide on the pay page. */
  method?: ShopPaymentMethod;
}

/** POST /shop/orders/:id/method — the pay page's pick for a `choose` order (public by order id). */
export interface ShopOrderChooseMethodRequest {
  method: 'crypto' | 'card';
}

/** POST /shop/orders → an order to pay; GET /shop/orders/:id → its state. */
export interface ShopOrderView {
  id: string;
  sku: string;
  provider: ShopPaymentProvider;
  status: ShopOrderStatus;
  priceCents: number;
  currency: string;
  method: ShopPaymentMethod;
  /** Bonus percent this order grants on top of the pack (crypto only; 0 for card). */
  bonusPercent: number;
  /** True when this is the account's first purchase of a gem tier: the gems are doubled. */
  firstPurchase: boolean;
  /** The website page that hosts the provider's checkout for this order. */
  payUrl: string;
  /** Card orders: Stripe's hosted checkout page. Null for crypto (the widget opens in place). */
  checkoutUrl: string | null;
  /** The provider's own order id, for the checkout widget. */
  providerOrderId: string;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  /** Present once paid: the wallet after the grant. */
  wallet?: WalletResources;
}

/** GET /shop/orders — the player's recent orders, newest first. */
export interface ShopOrderListResponse {
  orders: ShopOrderView[];
}

/** What the pay page needs to open the checkout widget (public, by order id). */
export interface ShopOrderCheckout {
  id: string;
  sku: string;
  status: ShopOrderStatus;
  provider: ShopPaymentProvider;
  method: ShopPaymentMethod;
  bonusPercent: number;
  /** First purchase of a gem tier: the pay page can say the gems are doubled. */
  firstPurchase: boolean;
  providerOrderId: string;
  /** Crypto provider public project id for the widget; empty when crypto is off. */
  projectId: string;
  /** Card orders: Stripe's hosted checkout page. */
  checkoutUrl: string | null;
  /** Which methods this server offers, for a `choose` order's buttons. */
  cardAvailable: boolean;
  cryptoAvailable: boolean;
  /** What crypto would add to this pack, in percent (0 for treasure boxes). */
  cryptoBonusPercent: number;
  priceCents: number;
  currency: string;
  title: string;
  /** Display name of the buying account, so the page can show who is paying. */
  buyerName: string;
  /** Deep link / URL to return to the client that started the order, if any. */
  returnUrl: string | null;
}

/** GET /admin/shop/orders — one purchase as Studio lists it. */
export interface AdminShopOrderRow {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  sku: string;
  provider: ShopPaymentProvider;
  method: ShopPaymentMethod;
  bonusPercent: number;
  firstPurchase: boolean;
  providerOrderId: string;
  status: ShopOrderStatus;
  priceCents: number;
  currency: string;
  platform: string;
  createdAt: string;
  paidAt: string | null;
  paidCrypto: string | null;
  paidCryptoAmount: string | null;
  /** Fiat received after the provider's fees, as it reported it. */
  incomeFiat: string | null;
  granted: WalletResources | null;
}

export interface AdminShopOrdersResponse {
  orders: AdminShopOrderRow[];
  /** Totals over the listed window: paid count and gross / net in cents. */
  paidCount: number;
  grossCents: number;
  netCents: number;
}
