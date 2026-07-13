/** Request body for POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Successful login — use `accessToken` as `Authorization: Bearer <token>`. */
export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: import('./user').UserProfile;
}
