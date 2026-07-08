/** Crop rectangle for sprite sheets. */
export interface GfxRectCrop {
  x: number;
  y?: number;
  width: number;
  height?: number;
}

/** Single-image GFX entry (cards, screen UI). */
export interface GfxImageEntry {
  kind: 'image';
  gfxKey: string;
  path: string;
}

/** Multi-frame animation clip (plants, zombies, bullets). */
export interface GfxClipEntry {
  kind: 'clip';
  gfxKey: string;
  directory: string;
  prefix: string;
  frameCount: number;
}

export type GfxManifestEntry = GfxImageEntry | GfxClipEntry;

export interface GfxManifest {
  version: 1;
  generatedAt: string;
  graphicsRoot: string;
  clips: Record<string, GfxClipEntry>;
  images: Record<string, GfxImageEntry>;
}

/** Animation slot — name and gfxKey are the same (folder name). */
export interface GfxAnimationSlot {
  /** Folder name under the unit gfx directory */
  name: string;
  /** Same as name — the animation folder name used by the game */
  gfxKey: string;
}

export interface GfxClipPreviewInfo {
  gfxKey: string;
  kind: 'clip' | 'image';
  frameCount: number;
  directory?: string;
  prefix?: string;
}

/** Parent folder grouping clips for one unit, e.g. Plants/Peashooter or Plants/Chomper */
export function getGfxEntityFolder(clip: GfxClipEntry): string {
  const parts = clip.directory.split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/');
  return parts.slice(0, -1).join('/');
}

/** All clip keys under a unit gfx folder, e.g. Plants/Peashooter */
export function gfxClipsInFolder(folder: string, clips: Record<string, GfxClipEntry>): string[] {
  if (!folder) return [];
  const normalized = folder.replace(/\\/g, '/').replace(/\/$/, '');
  return Object.values(clips)
    .filter((clip) => getGfxEntityFolder(clip) === normalized)
    .map((clip) => clip.gfxKey)
    .sort((a, b) => a.localeCompare(b));
}

/** All clip keys belonging to the same unit folder as baseKey (idle or walk). */
export function relatedGfxClipKeys(baseKey: string, clips: Record<string, GfxClipEntry>): string[] {
  if (!baseKey) return [];
  const base = clips[baseKey];
  if (!base) return clips[baseKey] ? [baseKey] : [];
  const folder = getGfxEntityFolder(base);
  return Object.values(clips)
    .filter((clip) => getGfxEntityFolder(clip) === folder)
    .map((clip) => clip.gfxKey)
    .sort((a, b) => a.localeCompare(b));
}

export interface CreateGfxClipRequest {
  /** Animation name — subfolder under sprites/animations/ */
  animationName: string;
  /** Resource category: Plants | Insects | Bullets */
  category: 'Plants' | 'Insects' | 'Bullets';
  /** PascalCase unit folder, e.g. CherryBomb */
  unitFolder: string;
  frameFilePaths: string[];
}

/** @deprecated Legacy manifest-based clip directory */
export function animationClipDirectory(entityFolder: string, animationName: string): string {
  const entity = entityFolder.replace(/\\/g, '/').replace(/\/$/, '');
  const unitName = entity.split('/').pop() ?? entity;
  if (animationName === unitName) return entity;
  return `${entity}/${animationName}`;
}

/** Gfx clip name → seed card image key slug overrides */
export const PLANT_CARD_SLUG: Record<string, string> = {
  Repeater: 'repeaterpea',
  RepeaterPea: 'repeaterpea',
  Threepeater: 'threepeashooter',
  SunFlower: 'sunflower',
  SunShroom: 'sunshroom',
  WallNut: 'wallnut',
  CherryBomb: 'cherrybomb',
  Chomper: 'chomper',
  HypnoShroom: 'hypnoshroom',
  IceShroom: 'iceshroom',
  Jalapeno: 'jalapeno',
  PotatoMine: 'potatomine',
  PuffShroom: 'puffshroom',
  ScaredyShroom: 'scaredyshroom',
  SnowPea: 'snowpea',
  Spikeweed: 'spikeweed',
  Squash: 'squash',
  Peashooter: 'peashooter',
};

/** Template plant gfx name → idle animation clip key */
export const GFX_PLANT_IDLE: Record<string, string> = {
  Peashooter: 'Peashooter',
  SunFlower: 'SunFlower',
  SunShroom: 'SunShroom',
  WallNut: 'WallNut',
  CherryBomb: 'CherryBomb',
  Chomper: 'Chomper',
  HypnoShroom: 'HypnoShroom',
  IceShroom: 'IceShroom',
  Jalapeno: 'Jalapeno',
  PotatoMine: 'PotatoMine',
  PuffShroom: 'PuffShroom',
  Repeater: 'RepeaterPea',
  RepeaterPea: 'RepeaterPea',
  ScaredyShroom: 'ScaredyShroom',
  SnowPea: 'SnowPea',
  Spikeweed: 'Spikeweed',
  Squash: 'Squash',
  Threepeater: 'Threepeater',
};

/** @deprecated Use GFX_PLANT_IDLE */
export const PYTHON_PLANT_IDLE = GFX_PLANT_IDLE;

/** Template insect gfx name → walk animation clip key */
export const GFX_INSECT_WALK: Record<string, string> = {
  Zombie: 'Zombie',
  FlagZombie: 'FlagZombie',
  ConeheadZombie: 'ConeheadZombie',
  BucketheadZombie: 'BucketheadZombie',
  NewspaperZombie: 'NewspaperZombie',
};

/** @deprecated Use GFX_INSECT_WALK */
export const PYTHON_ZOMBIE_WALK = GFX_INSECT_WALK;

export function plantCardGfxKey(plantGfxName: string): string {
  const slug =
    PLANT_CARD_SLUG[plantGfxName] ??
    plantGfxName.replace(/([a-z])([A-Z])/g, '$1$2').toLowerCase();
  return `card_${slug}`;
}

export function defaultPlantClientAssets(plantGfxName: string): {
  folder: string;
  idle: string;
  attack: string;
  scale: number;
} {
  const idle = GFX_PLANT_IDLE[plantGfxName] ?? plantGfxName;
  return {
    folder: plantGfxName,
    idle,
    attack: idle,
    scale: 1,
  };
}

export function defaultInsectClientAssets(zombieGfxName: string): {
  folder: string;
  walk: string;
  attack: string;
  die: string;
  cropX: number;
  cropWidth: number;
  scale: number;
} {
  const walk = GFX_INSECT_WALK[zombieGfxName] ?? 'Zombie';
  const folder = zombieGfxName === 'Zombie' ? 'NormalZombie' : zombieGfxName;
  return {
    folder,
    walk,
    attack: `${walk}Attack`,
    die: walk === 'NewspaperZombie' ? 'NewspaperZombieDie' : 'ZombieDie',
    cropX: 62,
    cropWidth: 90,
    scale: 1,
  };
}
