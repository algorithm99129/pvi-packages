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

/** Payment provider that took the money. */
export type ShopPaymentProvider = 'cryptumpay';

/** POST /shop/orders */
export interface ShopOrderCreateRequest {
  sku: string;
  /** Where the pay page sends the player afterwards: 'web' (default), 'webgl' or 'android'. */
  platform?: 'web' | 'webgl' | 'android';
}

/** POST /shop/orders → an order to pay; GET /shop/orders/:id → its state. */
export interface ShopOrderView {
  id: string;
  sku: string;
  provider: ShopPaymentProvider;
  status: ShopOrderStatus;
  priceCents: number;
  currency: string;
  /** The website page that hosts the provider's checkout for this order. */
  payUrl: string;
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
  providerOrderId: string;
  /** Provider public project id for the widget. */
  projectId: string;
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
