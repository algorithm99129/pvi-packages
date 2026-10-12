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

/** Starter pack contents (IAP stub until store billing lands). */
export const SHOP_STARTER_PACK_GRANT: WalletResources = {
  coin: 20_000,
  gem: 250,
  leaf: 200,
};

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
}

/** GET /shop/resources */
export interface BuyResourceCatalog {
  coin: BuyResourceOffer;
  gem: BuyResourceOffer;
  leaf: BuyResourceOffer;
  starterPack: StarterPackOffer;
  /** Gems charged per leaf (`LEAF_GEM_PRICE` from logic.json). */
  leafGemPrice: number;
  /** Gems in the $10 pack (`GEM_PACK_10_USD`). */
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
  [SHOP_SKU_GEM_PACK_10]: 1000,
  [SHOP_SKU_STARTER_PACK]: 499,
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
