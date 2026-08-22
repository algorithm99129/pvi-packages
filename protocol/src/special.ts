import type { UnitCellAnchor } from './unit-sizing';

export const EGG_GROUP_SPECIAL_ID = 'egg_group';

/** Lawn special props (egg groups, etc.) authored in the editor. */
export interface SpecialDefinition {
  id: string;
  displayName: string;
  /** Resources path without extension, e.g. `Special/EggGroup`. */
  sprite: string;
  cellAnchor?: UnitCellAnchor;
  /** @deprecated Prefer cellAnchor. */
  cellWidthFill?: number;
  scale?: number;
  schemaVersion?: number;
}

export function defaultEggGroupSpritePath(): string {
  return 'Special/EggGroup';
}
