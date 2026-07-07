/** Electron editor persisted workspace — client & server directory paths */
export interface EditorWorkspaceConfig {
  version: 1;
  name: string;
  /** Absolute or repo-relative path to Unity project root */
  clientDirectory: string;
  /** Absolute or repo-relative path to NestJS API project root (balance JSON under data/game/) */
  serverDirectory: string;
  lastOpenedAt?: string;
}

export const DEFAULT_WORKSPACE: EditorWorkspaceConfig = {
  version: 1,
  name: 'Garden Siege',
  clientDirectory: 'apps/client',
  serverDirectory: 'apps/api',
};
