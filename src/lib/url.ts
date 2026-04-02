// ─── URL safety utilities ───────────────────────────────────────────────────
// Prevents XSS via javascript: / data: / vbscript: URIs in user-supplied URLs.

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/**
 * Returns the URL string if it uses an allowed scheme (http/https), or `null`
 * if the URL is invalid or uses a dangerous scheme (javascript:, data:, etc.).
 *
 * Use this wherever user-supplied URLs are rendered as `href` attributes.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (ALLOWED_SCHEMES.has(parsed.protocol)) {
      return parsed.href; // normalised
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates a VOD URL for storage. Returns the sanitised URL or null.
 * Empty/whitespace strings return null (clear the field).
 */
export function validateVodUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return safeExternalUrl(url.trim());
}
