/** Relative paths inside client / server dirs for exported bundles */
export const CLIENT_EXPORT_PATHS = {
  plants: 'assets/data/plants.json',
  insects: 'assets/data/insects.json',
  missions: 'assets/data/missions.json',
  maps: 'assets/data/maps.json',
  balanceVersion: 'assets/data/balance-version.json',
  mediaRoot: 'assets/game',
} as const;

export const SERVER_EXPORT_PATHS = {
  plants: 'plants.json',
  insects: 'insects.json',
  missions: 'missions.json',
  maps: 'maps.json',
  balanceVersion: 'balance-version.json',
} as const;
