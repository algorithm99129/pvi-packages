/** Player currencies — coin, gem, leaf. */
export interface WalletResources {
  coin: number;
  gem: number;
  leaf: number;
}

export const EMPTY_WALLET: WalletResources = { coin: 0, gem: 0, leaf: 0 };

export const DEFAULT_STARTER_WALLET: WalletResources = {
  coin: 500,
  gem: 0,
  leaf: 10,
};
