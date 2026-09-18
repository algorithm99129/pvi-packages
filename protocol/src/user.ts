/** Account privilege — only admins may call editor admin Nest endpoints. */
export type UserRole = 'player' | 'admin';

/** Request body for POST /api/users */
export interface CreateUserRequest {
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
  /** Current team id when the player belongs to a team; otherwise null/omitted. */
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}
