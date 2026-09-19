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

/** POST /shop/purchase */
export interface ShopPurchaseRequest {
  sku: string;
}

export interface ShopPurchaseResult {
  sku: string;
  wallet: WalletResources;
}
