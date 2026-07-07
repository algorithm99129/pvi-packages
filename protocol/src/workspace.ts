/** Electron editor persisted workspace — client & server directory paths */
export interface EditorWorkspaceConfig {
  version: 1;
  name: string;
  /** Absolute or repo-relative path to Unity project root */
  clientDirectory: string;
  /** Absolute or repo-relative path to server runtime balance JSON */
  serverDirectory: string;
  lastOpenedAt?: string;
}

export const DEFAULT_WORKSPACE: EditorWorkspaceConfig = {
  version: 1,
  name: 'Garden Siege',
  clientDirectory: 'apps/client',
  serverDirectory: 'apps/api/data/game',
};
