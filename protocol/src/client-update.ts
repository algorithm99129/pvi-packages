/** Dropbox-hosted Android client update manifest (APK + OBB). */

export interface AndroidObbDescriptor {
  /** Canonical file name, e.g. main.1.com.gardensiege.game.obb */
  fileName: string;
  /** Absolute or host-relative URL to download the OBB. */
  url: string;
  sizeBytes: number;
  /** Lowercase hex SHA-256 of the OBB bytes. */
  sha256: string;
  /** Bumps on asset-only publishes without changing APK versionCode. */
  contentVersion: number;
}

/** Dropbox-hosted android-update.json */
export interface AndroidUpdateManifest {
  latestVersionCode: number;
  latestVersionName: string;
  /** Installed APK below this must install a new APK manually. */
  minSupportedVersionCode: number;
  /** Manual APK download URL (no in-app install). */
  apkUrl: string;
  releaseNotes?: string;
  mainObb: AndroidObbDescriptor;
}

/** Editor secrets for Dropbox Android release publishing (token never sent to Nest). */
export interface EditorDropboxReleaseSecrets {
  dropboxAccessToken?: string;
  /** Dropbox folder path inside the app folder, e.g. /android-releases */
  folderPath?: string;
  /** Last known direct URL for android-update.json (written into the Unity client). */
  manifestUrl?: string;
}

export interface EditorDropboxReleasePublicConfig {
  hasAccessToken: boolean;
  accessTokenPreview?: string;
  folderPath: string;
  manifestUrl?: string;
}

export interface AndroidDropboxPublishRequest {
  apkPath: string;
  obbPath: string;
  latestVersionCode: number;
  latestVersionName: string;
  minSupportedVersionCode?: number;
  releaseNotes?: string;
  /** Optional override; otherwise uses saved token. */
  dropboxAccessToken?: string;
  folderPath?: string;
}

export interface AndroidDropboxPublishResult {
  manifest: AndroidUpdateManifest;
  manifestUrl: string;
  apkUrl: string;
  obbUrl: string;
  /** Path written under the Unity client Resources folder. */
  clientSourcePath: string;
}

/** Unity Resources/Config/android-update-source.json */
export interface AndroidUpdateSourceConfig {
  /** Direct Dropbox URL for android-update.json */
  manifestUrl: string;
}

export const DEFAULT_DROPBOX_RELEASE_FOLDER = '/android-releases';
export const ANDROID_UPDATE_SOURCE_RELATIVE = 'Config/android-update-source.json';

export function normalizeAndroidUpdateManifest(
  raw: Partial<AndroidUpdateManifest> | null | undefined,
): AndroidUpdateManifest | null {
  if (raw == null || raw.mainObb == null) return null;
  const obb = raw.mainObb;
  const fileName = String(obb.fileName ?? '').trim();
  const url = String(obb.url ?? '').trim();
  const sha256 = String(obb.sha256 ?? '').trim().toLowerCase();
  if (!fileName || !url || !sha256) return null;

  return {
    latestVersionCode: Math.max(0, Math.floor(Number(raw.latestVersionCode) || 0)),
    latestVersionName: String(raw.latestVersionName ?? '').trim() || '0.0.0',
    minSupportedVersionCode: Math.max(
      0,
      Math.floor(Number(raw.minSupportedVersionCode) || 0),
    ),
    apkUrl: String(raw.apkUrl ?? '').trim(),
    ...(raw.releaseNotes != null && String(raw.releaseNotes).trim().length > 0
      ? { releaseNotes: String(raw.releaseNotes).trim() }
      : {}),
    mainObb: {
      fileName,
      url,
      sizeBytes: Math.max(0, Math.floor(Number(obb.sizeBytes) || 0)),
      sha256,
      contentVersion: Math.max(0, Math.floor(Number(obb.contentVersion) || 0)),
    },
  };
}
