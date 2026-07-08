/** Resource category folders under Assets/Resources (client) or Resources (server). */
export type ResourceCategory = 'Plants' | 'Insects' | 'Bullets' | 'Missions' | 'Maps' | 'Screen';

export const RESOURCE_CATEGORIES = {
  plants: 'Plants',
  insects: 'Insects',
  bullets: 'Bullets',
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

export function unitCardResourcePath(category: ResourceCategory, folderName: string): string {
  return `${unitResourceDir(category, folderName)}/sprites/card`;
}

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
