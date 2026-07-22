/** Client/editor avatar entry — image is Unity Resources path (no extension). */
export interface AvatarDefinition {
  id: string;
  /** Unity Resources path without extension, e.g. `Avatars/pea`. */
  image: string;
}

/** Server catalog entry — API only tracks ids (images live on the client). */
export interface AvatarIdEntry {
  id: string;
}

export const AVATARS_FOLDER = 'Avatars';

export function avatarImagePath(id: string): string {
  return `${AVATARS_FOLDER}/${id}`;
}

export function avatarImageFileName(id: string, extension = 'png'): string {
  return `${id}.${extension.replace(/^\./, '')}`;
}

/** Normalize a server avatars.json payload into a list of ids. */
export function normalizeAvatarIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const row of raw) {
    if (typeof row === 'string') {
      const id = row.trim();
      if (id) ids.push(id);
      continue;
    }
    if (row && typeof row === 'object' && typeof (row as AvatarIdEntry).id === 'string') {
      const id = (row as AvatarIdEntry).id.trim();
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}
