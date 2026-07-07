/** Relative paths inside Unity client / server dirs for exported bundles */
export const CLIENT_EXPORT_PATHS = {
  plants: 'Assets/Resources/data/plants.json',
  insects: 'Assets/Resources/data/insects.json',
  missions: 'Assets/Resources/data/missions.json',
  maps: 'Assets/Resources/data/maps.json',
  balanceVersion: 'Assets/Resources/data/balance-version.json',
  branding: 'Assets/Resources/data/branding.json',
  mediaRoot: 'Assets/Resources/game',
} as const;

export const SERVER_EXPORT_PATHS = {
  plants: 'plants.json',
  insects: 'insects.json',
  missions: 'missions.json',
  maps: 'maps.json',
  balanceVersion: 'balance-version.json',
} as const;
