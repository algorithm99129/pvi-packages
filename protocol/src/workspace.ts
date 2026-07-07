/** Electron editor persisted workspace — client & server directory paths */
export interface EditorWorkspaceConfig {
  version: 1;
  name: string;
  /** Absolute or repo-relative path to Cocos Creator project root */
  clientDirectory: string;
  /** Absolute or repo-relative path to server game-data import root */
  serverDirectory: string;
  /** Optional: monorepo game-data source (default packages/game-data) */
  sourceDataDirectory?: string;
  lastOpenedAt?: string;
}

export const DEFAULT_WORKSPACE: EditorWorkspaceConfig = {
  version: 1,
  name: 'Garden Siege',
  clientDirectory: 'apps/client',
  serverDirectory: 'apps/api/data/game',
  sourceDataDirectory: 'packages/game-data',
};
