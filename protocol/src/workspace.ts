/** Electron editor persisted workspace — client & server directory paths */
import { DEFAULT_GALLERY_DIRECTORY } from './gallery';
import { DEFAULT_MONGODB_URI } from './analysis';

export interface EditorWorkspaceConfig {
  version: 1;
  name: string;
  /** Absolute or repo-relative path to Unity project root */
  clientDirectory: string;
  /** Absolute or repo-relative path to NestJS API project root (balance JSON under Resources/) */
  serverDirectory: string;
  /** Absolute or repo-relative folder for AI-generated images (default: gallery at repo root) */
  galleryDirectory?: string;
  /**
   * MongoDB connection URI for player/user analysis (same DB as the Nest API).
   * Editor reads this directly — no HTTP API required.
   */
  mongodbUri?: string;
  /**
   * @deprecated Balance/catalog is loaded from local Resources/. Kept for old workspace files.
   */
  apiBaseUrl?: string;
  lastOpenedAt?: string;
}

export const DEFAULT_WORKSPACE: EditorWorkspaceConfig = {
  version: 1,
  name: 'Garden Siege',
  clientDirectory: 'apps/client',
  serverDirectory: 'apps/api',
  galleryDirectory: DEFAULT_GALLERY_DIRECTORY,
  mongodbUri: DEFAULT_MONGODB_URI,
};
