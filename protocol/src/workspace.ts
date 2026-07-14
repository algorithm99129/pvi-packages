/** Electron editor persisted workspace — client & server directory paths */
import { DEFAULT_GALLERY_DIRECTORY } from './gallery';

export interface EditorWorkspaceConfig {
  version: 1;
  name: string;
  /** Absolute or repo-relative path to Unity project root */
  clientDirectory: string;
  /** Absolute or repo-relative path to NestJS API project root (balance JSON under Resources/) */
  serverDirectory: string;
  /** Absolute or repo-relative folder for AI-generated images (default: gallery at repo root) */
  galleryDirectory?: string;
  /** Nest API base URL for runtime catalog (plants/insects with resolved stats). */
  apiBaseUrl?: string;
  lastOpenedAt?: string;
}

export const DEFAULT_WORKSPACE: EditorWorkspaceConfig = {
  version: 1,
  name: 'Garden Siege',
  clientDirectory: 'apps/client',
  serverDirectory: 'apps/api',
  galleryDirectory: DEFAULT_GALLERY_DIRECTORY,
  apiBaseUrl: 'http://localhost:3000/api',
};
