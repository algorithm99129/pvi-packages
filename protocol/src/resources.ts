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

/** Basename for Spine skeleton files inside `anim/` (e.g. character.json). */
export const SPINE_SKELETON_BASENAME = 'character';

/** `{Category}/{Folder}/anim` */
export function unitSpineDir(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/${SPINE_ANIM_DIR}`;
}

export function unitSpineSkeletonJsonPath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.json`;
}

export function unitSpineAtlasPath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.atlas.txt`;
}

/** Atlas file candidates — Unity Spine exports use `.atlas.txt`; legacy `.atlas` is supported. */
export function unitSpineAtlasCandidates(category: ResourceCategory, folderName: string): string[] {
  const dir = unitSpineDir(category, folderName);
  return [
    `${dir}/${SPINE_SKELETON_BASENAME}.atlas.txt`,
    `${dir}/${SPINE_SKELETON_BASENAME}.atlas`,
  ];
}

export function unitSpineTexturePath(category: ResourceCategory, folderName: string): string {
  return `${unitSpineDir(category, folderName)}/${SPINE_SKELETON_BASENAME}.png`;
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
