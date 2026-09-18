/** Account privilege — only admins may call editor admin Nest endpoints. */
export type UserRole = 'player' | 'admin';

/** Whether the account is a human player or an AI bot. */
export type PlayerType = 'human' | 'ai';

/** Request body for POST /api/users */
export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
}

/** Request body for POST /api/users/bots (requires bot register secret). */
export interface CreateBotUserRequest {
  email: string;
  displayName: string;
  password: string;
}

/** Public user profile returned by the API (no secrets). */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  /** Selected avatar id from Resources/Avatars catalog. */
  avatarId: string;
  /** Account role (default player). */
  role: UserRole;
  /** human | ai — bots created via POST /users/bots are `ai`. */
  playerType: PlayerType;
  /** Current team id when the player belongs to a team; otherwise null/omitted. */
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}
