import { getLocale } from "next-intl/server";
import { getChangelogEntries } from "@/lib/changelog";
import { compileMDX } from "next-mdx-remote/rsc";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { ChangelogSeenMarker } from "./changelog-seen-marker";

export default async function ChangelogRoute() {
  const locale = await getLocale();
  const entries = await getChangelogEntries(locale);
  const t = await getTranslations("Changelog");

  return (
    <div className="space-y-6">
      {/* Mark latest version as seen (client-side localStorage) */}
      {entries.length > 0 && (
        <ChangelogSeenMarker version={entries[0].version} />
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gradient-gold">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            entries.map(async (entry, index) => {
              const { content } = await compileMDX({
                source: entry.source,
                options: { parseFrontmatter: false },
              });

              return (
                <Card
                  key={entry.slug}
                  className={
                    index === 0
                      ? "border-gold/30 surface-glow"
                      : "border-border/50"
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge
                        variant="outline"
                        className={
                          index === 0
                            ? "border-gold/50 text-gold"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {index === 0 && (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        v{entry.version}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <CardTitle className="text-xl mt-2">
                      {entry.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="changelog-prose text-sm">{content}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
