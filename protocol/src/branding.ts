/** Client branding — loading screen, title, etc. */
export interface ClientBrandingConfig {
  gameTitle?: string;
  /** Path relative to Assets/Resources, e.g. Screen/LoadingScreen */
  loadingScreenImage?: string;
}

/** Unity Resources path for the loading screen art (no extension — matches Screen/MainMenu). */
export const LOADING_SCREEN_IMAGE_PATH = 'Screen/LoadingScreen';

/** Editor upload / AI generation target (includes extension). */
export const LOADING_SCREEN_UPLOAD_PATH = 'Screen/LoadingScreen.png';

export const DEFAULT_BRANDING: ClientBrandingConfig = {
  gameTitle: 'Garden Siege',
  loadingScreenImage: LOADING_SCREEN_IMAGE_PATH,
};
