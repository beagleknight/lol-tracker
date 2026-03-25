import fs from "node:fs/promises";
import path from "node:path";

export interface ChangelogEntry {
  slug: string;
  version: string;
  date: string;
  title: string;
  /** Raw MDX source (without frontmatter) */
  source: string;
}

/**
 * Read all changelog MDX files for a given locale, sorted newest-first.
 * Falls back to "en" if no files exist for the requested locale.
 */
export async function getChangelogEntries(
  locale: string
): Promise<ChangelogEntry[]> {
  const changelogDir = path.join(process.cwd(), "changelog", locale);

  let files: string[];
  try {
    files = await fs.readdir(changelogDir);
  } catch {
    // Fallback to English if locale directory doesn't exist
    if (locale !== "en") {
      return getChangelogEntries("en");
    }
    return [];
  }

  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  const entries = await Promise.all(
    mdxFiles.map(async (filename) => {
      const filePath = path.join(changelogDir, filename);
      const raw = await fs.readFile(filePath, "utf-8");

      // Parse frontmatter manually (simple --- delimited block)
      const frontmatterMatch = raw.match(
        /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
      );
      if (!frontmatterMatch) return null;

      const frontmatterBlock = frontmatterMatch[1];
      const source = frontmatterMatch[2];

      // Parse YAML-like key: value pairs
      const meta: Record<string, string> = {};
      for (const line of frontmatterBlock.split("\n")) {
        const match = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
        if (match) {
          meta[match[1]] = match[2];
        }
      }

      if (!meta.version || !meta.date || !meta.title) return null;

      const slug = filename.replace(/\.mdx$/, "");

      return {
        slug,
        version: meta.version,
        date: meta.date,
        title: meta.title,
        source,
      } satisfies ChangelogEntry;
    })
  );

  // Filter nulls and sort newest-first by date
  return entries
    .filter((e): e is ChangelogEntry => e !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get the latest changelog version string (for "what's new" indicator).
 */
export async function getLatestChangelogVersion(): Promise<string | null> {
  const entries = await getChangelogEntries("en");
  return entries[0]?.version ?? null;
}
