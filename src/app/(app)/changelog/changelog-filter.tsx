"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ChangelogTag } from "@/lib/changelog";

const TAGS: (ChangelogTag | "all")[] = [
  "all",
  "feature",
  "fix",
  "improvement",
  "refactor",
];

const TAG_FILTER_KEYS: Record<
  "all" | ChangelogTag,
  "filterAll" | "filterFeature" | "filterFix" | "filterImprovement" | "filterRefactor"
> = {
  all: "filterAll",
  feature: "filterFeature",
  fix: "filterFix",
  improvement: "filterImprovement",
  refactor: "filterRefactor",
};

export function ChangelogFilter({
  activeTag,
}: {
  activeTag: ChangelogTag | undefined;
}) {
  const router = useRouter();
  const t = useTranslations("Changelog");

  function handleFilter(tag: ChangelogTag | "all") {
    if (tag === "all") {
      router.push("/changelog", { scroll: false });
    } else {
      router.push(`/changelog?tag=${tag}`, { scroll: false });
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => {
        const isActive =
          tag === "all" ? !activeTag : activeTag === tag;
        return (
          <Button
            key={tag}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilter(tag)}
            className={isActive ? "" : "text-muted-foreground"}
          >
            {t(TAG_FILTER_KEYS[tag])}
          </Button>
        );
      })}
    </div>
  );
}
