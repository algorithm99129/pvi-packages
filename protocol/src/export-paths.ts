import { RESOURCE_CATEGORIES } from './resources';

/** Unity client project — everything lives under Assets/Resources/ */
export const CLIENT_RESOURCES_ROOT = 'Assets/Resources';

export const CLIENT_EXPORT_PATHS = {
  resourcesRoot: CLIENT_RESOURCES_ROOT,
  plants: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.plants}/plants.json`,
  plantsDir: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.plants}`,
  insects: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.insects}/insects.json`,
  insectsDir: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.insects}`,
  bullets: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.bullets}/bullets.json`,
  bulletsDir: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.bullets}`,
  missions: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.missions}/missions.json`,
  maps: `${CLIENT_RESOURCES_ROOT}/${RESOURCE_CATEGORIES.maps}/maps.json`,
  avatars: `${CLIENT_RESOURCES_ROOT}/Avatars/avatars.json`,
  avatarsDir: `${CLIENT_RESOURCES_ROOT}/Avatars`,
  branding: `${CLIENT_RESOURCES_ROOT}/branding.json`,
  balanceVersion: `${CLIENT_RESOURCES_ROOT}/balance-version.json`,
  /** Unity Resources root for path resolution */
  mediaRoot: CLIENT_RESOURCES_ROOT,
  /** Editor uploads / generated art */
  customMediaRoot: 'custom',
} as const;

/** NestJS API — balance JSON under Resources/ (mirrors client category layout) */
export const SERVER_RESOURCES_DIR = 'Resources';

export const SERVER_EXPORT_PATHS = {
  resourcesRoot: SERVER_RESOURCES_DIR,
  plants: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.plants}/plants.json`,
  plantsDir: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.plants}`,
  insects: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.insects}/insects.json`,
  insectsDir: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.insects}`,
  bullets: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.bullets}/bullets.json`,
  bulletsDir: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.bullets}`,
  missions: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.missions}/missions.json`,
  maps: `${SERVER_RESOURCES_DIR}/${RESOURCE_CATEGORIES.maps}/maps.json`,
  avatars: `${SERVER_RESOURCES_DIR}/Avatars/avatars.json`,
  avatarsDir: `${SERVER_RESOURCES_DIR}/Avatars`,
  balanceVersion: `${SERVER_RESOURCES_DIR}/balance-version.json`,
  logic: `${SERVER_RESOURCES_DIR}/Systems/logic.json`,
} as const;

/** @deprecated Use SERVER_RESOURCES_DIR */
export const SERVER_DATA_DIR = SERVER_RESOURCES_DIR;

/** Absolute path to Unity client Resources folder. */
export function resolveClientResourcesDirectory(clientProjectRoot: string): string {
  const root = clientProjectRoot.replace(/\\/g, '/').replace(/\/$/, '');
  return `${root}/${CLIENT_RESOURCES_ROOT}`;
}

/** @deprecated Use resolveClientResourcesDirectory */
export function resolveClientGfxDirectory(clientProjectRoot: string): string {
  return resolveClientResourcesDirectory(clientProjectRoot);
}

const LEGACY_DATA_AGGREGATES: Record<string, string> = {
  branding: 'branding',
  'balance-version': 'balance-version',
  plants: `${RESOURCE_CATEGORIES.plants}/plants`,
  insects: `${RESOURCE_CATEGORIES.insects}/insects`,
  missions: `${RESOURCE_CATEGORIES.missions}/missions`,
  maps: `${RESOURCE_CATEGORIES.maps}/maps`,
  avatars: 'Avatars/avatars',
};

/**
 * Normalize a path relative to Assets/Resources.
 * Legacy gfx/, data/, and game/ prefixes are rewritten — never write under data/ or game/.
 */
export function normalizeClientMediaPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return normalized;

  if (normalized === 'data' || normalized === 'game') {
    return CLIENT_EXPORT_PATHS.customMediaRoot;
  }

  if (normalized.startsWith('game/')) {
    return `${CLIENT_EXPORT_PATHS.customMediaRoot}/${normalized.slice('game/'.length)}`;
  }

  if (normalized.startsWith('data/')) {
    const rest = normalized.slice('data/'.length);
    const aggregateKey = rest.replace(/\.json$/, '');
    if (LEGACY_DATA_AGGREGATES[aggregateKey]) {
      return LEGACY_DATA_AGGREGATES[aggregateKey];
    }
    return `${CLIENT_EXPORT_PATHS.customMediaRoot}/${rest}`;
  }

  if (normalized.startsWith(`${CLIENT_EXPORT_PATHS.customMediaRoot}/`)) {
    return normalized;
  }

  if (normalized.startsWith('gfx/')) {
    return normalized.slice('gfx/'.length);
  }

  if (
    normalized.startsWith('Plants/') ||
    normalized.startsWith('Insects/') ||
    normalized.startsWith('Bullets/') ||
    normalized.startsWith('Missions/') ||
    normalized.startsWith('Maps/') ||
    normalized.startsWith('Screen/') ||
    normalized.startsWith('Avatars/')
  ) {
    return normalized;
  }

  return `${CLIENT_EXPORT_PATHS.customMediaRoot}/${normalized}`;
}

/** Legacy workspaces may point serverDirectory at Resources or data/game — normalize to API project root */
export function normalizeServerProjectDirectory(configured: string): string {
  const normalized = configured.replace(/\\/g, '/').replace(/\/$/, '');
  for (const legacy of [SERVER_RESOURCES_DIR, 'data/game']) {
    if (normalized.endsWith(legacy)) {
      return normalized.slice(0, -legacy.length).replace(/\/$/, '') || configured;
    }
  }
  return configured;
}

export function resolveServerResourcesDirectory(serverProjectRoot: string): string {
  const root = normalizeServerProjectDirectory(serverProjectRoot);
  const normalized = root.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalized.endsWith(SERVER_RESOURCES_DIR)) return root;
  return `${root}/${SERVER_RESOURCES_DIR}`;
}

/** @deprecated Use resolveServerResourcesDirectory */
export function resolveServerDataDirectory(serverProjectRoot: string): string {
  return resolveServerResourcesDirectory(serverProjectRoot);
}
