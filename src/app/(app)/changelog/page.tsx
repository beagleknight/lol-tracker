import { Sparkles } from "lucide-react";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { compileMDX } from "next-mdx-remote/rsc";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChangelogEntries, type ChangelogTag } from "@/lib/changelog";

import { ChangelogFilter } from "./changelog-filter";
import { ChangelogImage } from "./changelog-image";
import { ChangelogPagination } from "./changelog-pagination";
import { ChangelogSeenMarker } from "./changelog-seen-marker";

const mdxComponents = {
  img: ChangelogImage,
};

const ENTRIES_PER_PAGE = 5;
const VALID_TAGS: ChangelogTag[] = ["feature", "fix", "improvement"];

const TAG_STYLES: Record<ChangelogTag, string> = {
  feature: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  fix: "bg-red-500/10 text-red-400 border-red-500/30",
  improvement: "bg-green-500/10 text-green-400 border-green-500/30",
};

export default async function ChangelogRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("Changelog");

  // Parse tag filter
  const tagParam = typeof params.tag === "string" ? params.tag : undefined;
  const activeTag =
    tagParam && VALID_TAGS.includes(tagParam as ChangelogTag)
      ? (tagParam as ChangelogTag)
      : undefined;

  // Get entries (optionally filtered by tag)
  const allEntries = await getChangelogEntries(locale, activeTag);

  // Parse page
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const totalPages = Math.max(1, Math.ceil(allEntries.length / ENTRIES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * ENTRIES_PER_PAGE;
  const pageEntries = allEntries.slice(startIndex, startIndex + ENTRIES_PER_PAGE);

  // We need the unfiltered latest version for the "seen" marker
  const unfilteredEntries = activeTag ? await getChangelogEntries(locale) : allEntries;

  return (
    <div className="space-y-6">
      {/* Mark latest version as seen (client-side localStorage) */}
      {unfilteredEntries.length > 0 && (
        <ChangelogSeenMarker version={unfilteredEntries[0].version} />
      )}

      <div>
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Tag filter bar */}
      <ChangelogFilter activeTag={activeTag} />

      {allEntries.length === 0 ? (
        <p className="text-muted-foreground">{activeTag ? t("noFilterResults") : t("empty")}</p>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            pageEntries.map(async (entry, index) => {
              const { content } = await compileMDX({
                source: entry.source,
                options: { parseFrontmatter: false },
                components: mdxComponents,
              });

              const isNewest = currentPage === 1 && index === 0 && !activeTag;

              return (
                <Card
                  key={entry.slug}
                  className={isNewest ? "surface-glow border-gold/30" : "border-border/50"}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          isNewest
                            ? "border-gold/50 text-gold"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {isNewest && <Sparkles className="mr-1 h-3 w-3" />}v{entry.version}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className={`text-xs ${TAG_STYLES[tag]}`}>
                          {t(
                            `tag${tag.charAt(0).toUpperCase()}${tag.slice(1)}` as
                              | "tagFeature"
                              | "tagFix"
                              | "tagImprovement",
                          )}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="mt-2 text-xl">{entry.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="changelog-prose text-sm">{content}</div>
                  </CardContent>
                </Card>
              );
            }),
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <ChangelogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              activeTag={activeTag}
            />
          )}
        </div>
      )}
    </div>
  );
}
