/** Runtime app settings stored in Mongo (singleton). */

export interface AppSettings {
  /** When false, POST /users rejects new human registrations. Login and bots stay open. */
  signupsEnabled: boolean;
  updatedAt?: string;
}

export interface PublicSignupsStatus {
  signupsEnabled: boolean;
}

export interface UpdateAppSettingsRequest {
  signupsEnabled?: boolean;
}

export interface AdminAppSettingsResult {
  ok: boolean;
  settings?: AppSettings;
  error?: string;
}
