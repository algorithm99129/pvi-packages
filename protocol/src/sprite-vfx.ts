/** Client/editor sprite flash VFX — PNG under Resources/VFX/Sprites. */
export interface SpriteVfxDefinition {
  /** Stem without extension, e.g. `BambooLancerFx`. */
  id: string;
  /** Unity Resources path without extension, e.g. `VFX/Sprites/BambooLancerFx`. */
  image: string;
}

export const SPRITE_VFX_FOLDER = 'VFX/Sprites';

export function spriteVfxImagePath(id: string): string {
  const stem = id.trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.[^./]+$/, '');
  return `${SPRITE_VFX_FOLDER}/${stem}`;
}

export function spriteVfxImageFileName(id: string, extension = 'png'): string {
  const stem = id.trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.[^./]+$/, '');
  return `${stem}.${extension.replace(/^\./, '')}`;
}

/** Normalize a Resources stem or path into a sprite-vfx id (file stem). */
export function normalizeSpriteVfxId(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^.*\//, '')
    .replace(/\.[^./]+$/, '');
}

/**
 * Sprite flash presentation — GDD §22.13 purpose styles
 * (slash vs ring vs orb vs trail, etc.).
 */
export type AbilityVfxStyle =
  | 'slash'
  | 'impact'
  | 'ring'
  | 'cloud'
  | 'burst'
  | 'pulse'
  | 'orb'
  | 'glint'
  | 'trail'
  | 'veil'
  | 'aura'
  | 'burrow';

export const ABILITY_VFX_STYLE_OPTIONS: ReadonlyArray<{ id: AbilityVfxStyle; label: string }> = [
  { id: 'slash', label: 'Slash (melee crescent)' },
  { id: 'impact', label: 'Impact (stun slam ring)' },
  { id: 'ring', label: 'Ring (reveal / debuff)' },
  { id: 'cloud', label: 'Cloud (slow mist)' },
  { id: 'burst', label: 'Burst (knockback puff)' },
  { id: 'pulse', label: 'Pulse (charge / coat)' },
  { id: 'orb', label: 'Orb (heal / shield droplet)' },
  { id: 'glint', label: 'Glint (reflect flash)' },
  { id: 'trail', label: 'Trail (slick / siphon)' },
  { id: 'veil', label: 'Veil (concealment)' },
  { id: 'aura', label: 'Aura (speed buzz)' },
  { id: 'burrow', label: 'Burrow (soil ripple)' },
];

/**
 * Default sprite VFX size as a fraction of lawn cell width
 * (1 = effect spans one cell; sprite longest edge).
 */
export const DEFAULT_SPRITE_VFX_CELL_SIZE = 1;

export function normalizeSpriteVfxCellSize(
  raw: number | null | undefined,
  fallback = DEFAULT_SPRITE_VFX_CELL_SIZE,
): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  if (!(n > 0)) return fallback;
  return Math.min(4, Math.max(0.15, n));
}
