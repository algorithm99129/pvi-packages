/** Request body for POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Request body for POST /api/auth/verify-email */
export interface VerifyEmailRequest {
  email: string;
  /** Six-digit code from the sign-up email. */
  code: string;
}

export interface VerifyEmailResponse {
  verified: true;
}

/** Request body for POST /api/auth/resend-verification */
export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  sent: true;
}

/** Successful login — use `accessToken` as `Authorization: Bearer <token>`. */
export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: import('./user').UserProfile;
}
