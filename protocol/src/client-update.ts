/** Self-hosted Android client update manifest (APK + OBB). */

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

/** Response from GET /api/client/android-update */
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
