/** Resource category folders under Assets/Resources (client) or Resources (server). */
export type ResourceCategory =
  | 'Plants'
  | 'Insects'
  | 'Bullets'
  | 'Equipment'
  | 'Potions'
  | 'Missions'
  | 'Maps'
  | 'Screen';

export const RESOURCE_CATEGORIES = {
  plants: 'Plants',
  insects: 'Insects',
  bullets: 'Bullets',
  equipment: 'Equipment',
  potions: 'Potions',
  missions: 'Missions',
  maps: 'Maps',
  screen: 'Screen',
} as const;

/** PascalCase gfx folder name → snake_case entity id. */
export function folderToEntityId(folderName: string): string {
  return folderName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/** Unit folder name under a category, e.g. CherryBomb */
export function unitResourceDir(category: ResourceCategory, folderName: string): string {
  return `${category}/${folderName}`;
}

export function unitAttributePath(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/attribute.json`;
}

/** Seed-packet / list icon at unit root. */
export function unitAvatarPath(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/avatar`;
}

/**
 * Static battle still at unit root (`skeleton.png`).
 * Used in battle / roster only when Spine under `anim/` is not present.
 */
export function unitBattleStillPath(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/skeleton`;
}

/** @deprecated Use unitAvatarPath */
export function unitCardResourcePath(category: ResourceCategory, folderName: string): string {
  return unitAvatarPath(category, folderName);
}

/** Subfolder under each unit that holds Spine export files. */
export const SPINE_ANIM_DIR = 'anim';

/**
 * Preferred basename when multiple Spine skeletons exist under `anim/`.
 * Kept for backward compatibility — discovery accepts any name.
 */
export const SPINE_SKELETON_BASENAME = 'character';

/** `{Category}/{Folder}/anim` */
export function unitSpineDir(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/${SPINE_ANIM_DIR}`;
}

export type SpineSkeletonFormat = 'json' | 'skel';

/** One skeleton + atlas (+ optional texture) discovered under a unit `anim/` folder. */
export interface DiscoveredSpinePair {
  /** File basename without skeleton extension (e.g. `character`, `AcaciaArcher`). */
  basename: string;
  /** Relative path from Resources root to skeleton (`.json`, `.skel`, or `.skel.bytes`). */
  skeletonPath: string;
  format: SpineSkeletonFormat;
  /** Relative path to `.atlas.txt` or `.atlas`. */
  atlasPath: string;
  /** Relative path to atlas image when present (usually `.png`). */
  texturePath: string | null;
}

/** @deprecated Prefer discover + pick; kept for callers that still assume `character.json`. */
export function unitSpineSkeletonJsonPath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.json`;
}

/** @deprecated Prefer discover + pick. */
export function unitSpineAtlasPath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.atlas.txt`;
}

/** @deprecated Prefer discover + pick. */
export function unitSpineAtlasCandidates(category: ResourceCategory, folderName: string): string[] {
  const dir = unitSpineDir(category, folderName);
  return [
    `${dir}/${SPINE_SKELETON_BASENAME}.atlas.txt`,
    `${dir}/${SPINE_SKELETON_BASENAME}.atlas`,
  ];
}

/** @deprecated Prefer discover + pick. */
export function unitSpineTexturePath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.png`;
}

function spineSkeletonBasename(fileName: string): { basename: string; format: SpineSkeletonFormat } | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.skel.bytes')) {
    return { basename: fileName.slice(0, -'.skel.bytes'.length), format: 'skel' };
  }
  if (lower.endsWith('.skel')) {
    return { basename: fileName.slice(0, -'.skel'.length), format: 'skel' };
  }
  if (lower.endsWith('.json')) {
    // Unity/Spine side-car names, not skeletons.
    if (
      lower.endsWith('.atlas.json') ||
      lower === 'attribute.json' ||
      lower.endsWith('.meta.json')
    ) {
      return null;
    }
    return { basename: fileName.slice(0, -'.json'.length), format: 'json' };
  }
  return null;
}

function findAtlasForBasename(fileNames: string[], basename: string): string | null {
  const lowerBase = basename.toLowerCase();
  const preferred = [`${basename}.atlas.txt`, `${basename}.atlas`];
  for (const name of preferred) {
    if (fileNames.some((f) => f === name)) return name;
  }
  // Case-insensitive fallback for Windows exports.
  for (const name of fileNames) {
    const lower = name.toLowerCase();
    if (lower === `${lowerBase}.atlas.txt` || lower === `${lowerBase}.atlas`) return name;
  }
  return null;
}

function findTextureForBasename(fileNames: string[], basename: string): string | null {
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  for (const ext of exts) {
    const exact = `${basename}${ext}`;
    if (fileNames.some((f) => f === exact)) return exact;
    const hit = fileNames.find((f) => f.toLowerCase() === exact.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/**
 * List atlas+skeleton pairs in a unit `anim/` folder from a flat filename list
 * (no recursion — only that folder).
 */
export function listSpinePairsInAnimDir(
  animDirRel: string,
  fileNames: string[],
): DiscoveredSpinePair[] {
  const dir = animDirRel.replace(/\\/g, '/').replace(/\/$/, '');
  const pairs: DiscoveredSpinePair[] = [];

  for (const fileName of fileNames) {
    const skel = spineSkeletonBasename(fileName);
    if (!skel) continue;
    const atlasName = findAtlasForBasename(fileNames, skel.basename);
    if (!atlasName) continue;
    const textureName = findTextureForBasename(fileNames, skel.basename);
    pairs.push({
      basename: skel.basename,
      skeletonPath: `${dir}/${fileName}`,
      format: skel.format,
      atlasPath: `${dir}/${atlasName}`,
      texturePath: textureName ? `${dir}/${textureName}` : null,
    });
  }

  return pairs;
}

/**
 * Choose one Spine when `anim/` has multiple skeletons.
 * Prefer `character`, then a basename matching the unit folder, else A–Z first.
 */
export function pickSpinePair(
  pairs: DiscoveredSpinePair[],
  unitFolder?: string,
): DiscoveredSpinePair | null {
  if (!pairs.length) return null;
  if (pairs.length === 1) return pairs[0];

  const byPreferred = pairs.find(
    (p) => p.basename.toLowerCase() === SPINE_SKELETON_BASENAME.toLowerCase(),
  );
  if (byPreferred) return byPreferred;

  if (unitFolder) {
    const folderLower = unitFolder.toLowerCase();
    const byFolder = pairs.find((p) => p.basename.toLowerCase() === folderLower);
    if (byFolder) return byFolder;
  }

  return [...pairs].sort((a, b) =>
    a.basename.localeCompare(b.basename, undefined, { sensitivity: 'base' }),
  )[0];
}

/** Build destination paths under `anim/` for an imported spine (keeps source basename). */
export function unitSpineDestPaths(
  category: ResourceCategory,
  unitFolder: string,
  basename: string,
  format: SpineSkeletonFormat,
): { skeletonPath: string; atlasPath: string; texturePath: string } {
  const dir = unitSpineDir(category, unitFolder);
  const skeletonPath =
    format === 'skel' ? `${dir}/${basename}.skel.bytes` : `${dir}/${basename}.json`;
  return {
    skeletonPath,
    atlasPath: `${dir}/${basename}.atlas.txt`,
    texturePath: `${dir}/${basename}.png`,
  };
}


/** Legacy frame-clip animations (Bullets, Screen). */
export function unitAnimationsRoot(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/sprites/animations`;
}

export function unitAnimationDir(
  category: ResourceCategory,
  folderName: string,
  animationName: string,
): string {
  return `${unitAnimationsRoot(category, folderName)}/${animationName}`;
}

export function unitAnimationFramePath(
  category: ResourceCategory,
  folderName: string,
  animationName: string,
  frameIndex: number,
): string {
  return `${unitAnimationDir(category, folderName, animationName)}/${frameIndex}`;
}

/** Index manifest entry pointing at a unit folder. */
export interface ResourceUnitIndexEntry {
  id: string;
  folder: string;
}
