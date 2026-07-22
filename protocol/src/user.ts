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
  createdAt: string;
  updatedAt: string;
}
