/** Public Android client update manifest — GET /api/client/android-update */

export interface AndroidUpdateManifest {
  /** Play/store-style integer; compare to the installed APK versionCode. */
  latestVersionCode: number;
  /** Display version, e.g. "1.1.0". */
  latestVersionName: string;
  /**
   * Clients with versionCode strictly below this must install before playing.
   * Soft updates apply when minSupported ≤ local < latest.
   */
  minSupportedVersionCode: number;
  /** Absolute URL to the APK (e.g. https://host/updates/garden-siege.apk). */
  apkUrl: string;
  /** Optional human-readable notes shown during download. */
  releaseNotes?: string;
}
