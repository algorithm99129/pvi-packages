/** Relative paths inside Unity client project root */
export const CLIENT_EXPORT_PATHS = {
  plants: 'Assets/Resources/data/plants.json',
  insects: 'Assets/Resources/data/insects.json',
  missions: 'Assets/Resources/data/missions.json',
  maps: 'Assets/Resources/data/maps.json',
  balanceVersion: 'Assets/Resources/data/balance-version.json',
  branding: 'Assets/Resources/data/branding.json',
  mediaRoot: 'Assets/Resources/game',
} as const;

/** Balance JSON lives under this folder inside the NestJS API project root */
export const SERVER_DATA_DIR = 'data/game';

/** Relative paths inside NestJS API project root (serverDirectory) */
export const SERVER_EXPORT_PATHS = {
  plants: `${SERVER_DATA_DIR}/plants.json`,
  insects: `${SERVER_DATA_DIR}/insects.json`,
  missions: `${SERVER_DATA_DIR}/missions.json`,
  maps: `${SERVER_DATA_DIR}/maps.json`,
  balanceVersion: `${SERVER_DATA_DIR}/balance-version.json`,
} as const;

/** Legacy workspaces may point serverDirectory at data/game — normalize to API project root */
export function normalizeServerProjectDirectory(configured: string): string {
  const normalized = configured.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalized.endsWith(SERVER_DATA_DIR)) {
    return normalized.slice(0, -SERVER_DATA_DIR.length).replace(/\/$/, '') || configured;
  }
  return configured;
}

export function resolveServerDataDirectory(serverProjectRoot: string): string {
  const root = normalizeServerProjectDirectory(serverProjectRoot);
  const normalized = root.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalized.endsWith(SERVER_DATA_DIR)) return root;
  return `${root}/${SERVER_DATA_DIR}`;
}
