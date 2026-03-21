/**
 * Next.js instrumentation — runs once at server startup.
 *
 * Strips the dotenvx/dotenv v17 banner that gets prepended to environment
 * variables in certain Vercel runtime environments.
 *
 * The banner looks like:
 *   [dotenv@17.3.1] injecting env (6) from .env.local -- tip: ...\n<actual value>
 */
export function register() {
  const bannerPattern = /^\[dotenv@[^\]]+\][^\n]*\n/;

  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (value && bannerPattern.test(value)) {
      process.env[key] = value.replace(bannerPattern, "");
    }
  }
}
