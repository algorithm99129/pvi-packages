/** Client/editor team flag entry — image is Unity Resources path (no extension). */
export interface FlagDefinition {
  id: string;
  /** Unity Resources path without extension, e.g. `Flags/flag_000`. */
  image: string;
}

/** Server catalog entry — API only tracks ids (images live on the client). */
export interface FlagIdEntry {
  id: string;
}

export const FLAGS_FOLDER = 'Flags';

/** Default team banner when none is chosen. */
export const DEFAULT_FLAG_ID = 'flag_000';

export function flagImagePath(id: string): string {
  return `${FLAGS_FOLDER}/${id}`;
}

export function flagImageFileName(id: string, extension = 'png'): string {
  return `${id}.${extension.replace(/^\./, '')}`;
}

/** Normalize a server flags.json payload into a list of ids. */
export function normalizeFlagIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const row of raw) {
    if (typeof row === 'string') {
      const id = row.trim();
      if (id) ids.push(id);
      continue;
    }
    if (row && typeof row === 'object' && typeof (row as FlagIdEntry).id === 'string') {
      const id = (row as FlagIdEntry).id.trim();
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}
