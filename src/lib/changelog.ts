import fs from "node:fs/promises";
import path from "node:path";

export type ChangelogTag = "feature" | "fix" | "improvement" | "refactor";

export interface ChangelogEntry {
  slug: string;
  version: string;
  date: string;
  title: string;
  tags: ChangelogTag[];
  /** Raw MDX source (without frontmatter) */
  source: string;
}

/**
 * Compare two CalVer version strings (YYYY.MM.N) numerically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareCalVer(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Read all changelog MDX files for a given locale, sorted newest-first.
 * Falls back to "en" if no files exist for the requested locale.
 * Optionally filter by tag.
 */
export async function getChangelogEntries(
  locale: string,
  tag?: ChangelogTag
): Promise<ChangelogEntry[]> {
  const changelogDir = path.join(process.cwd(), "changelog", locale);

  let files: string[];
  try {
    files = await fs.readdir(changelogDir);
  } catch {
    // Fallback to English if locale directory doesn't exist
    if (locale !== "en") {
      return getChangelogEntries("en", tag);
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

      // Parse tags array: tags: ["feature", "fix"]
      let tags: ChangelogTag[] = [];
      const tagsLine = frontmatterBlock
        .split("\n")
        .find((l) => l.startsWith("tags:"));
      if (tagsLine) {
        const tagsMatch = tagsLine.match(/\[([^\]]*)\]/);
        if (tagsMatch) {
          tags = tagsMatch[1]
            .split(",")
            .map((t) => t.trim().replace(/["']/g, ""))
            .filter((t): t is ChangelogTag => t.length > 0);
        }
      }

      if (!meta.version || !meta.date || !meta.title) return null;

      const slug = filename.replace(/\.mdx$/, "");

      return {
        slug,
        version: meta.version,
        date: meta.date,
        title: meta.title,
        tags,
        source,
      } satisfies ChangelogEntry;
    })
  );

  // Filter nulls and sort newest-first by date, then by CalVer version as tiebreaker
  let result = entries
    .filter((e): e is ChangelogEntry => e !== null)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || compareCalVer(b.version, a.version)
    );

  // Apply tag filter if specified
  if (tag) {
    result = result.filter((e) => e.tags.includes(tag));
  }

  return result;
}

/**
 * Get the latest changelog version string (for "what's new" indicator).
 */
export async function getLatestChangelogVersion(): Promise<string | null> {
  const entries = await getChangelogEntries("en");
  return entries[0]?.version ?? null;
}
