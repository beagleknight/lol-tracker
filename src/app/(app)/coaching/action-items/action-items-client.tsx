"use client";

import { Loader2, Circle, Play, CheckCircle2, Trash2, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateActionItemStatus, deleteActionItem } from "@/app/actions/coaching";
import { Pagination, paginate, PAGE_SIZE } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-client";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";

interface ActionItemWithSession {
  id: number;
  sessionId: number;
  description: string;
  topic: string | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  coachName: string;
  sessionDate: Date;
}

interface ActionItemsClientProps {
  items: ActionItemWithSession[];
}

function ActionItemRow({ item, locale }: { item: ActionItemWithSession; locale: string }) {
  const t = useTranslations("ActionItems");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function cycleStatus() {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    const next = nextStatus[item.status];
    startTransition(async () => {
      try {
        await updateActionItemStatus(item.id, next);
        toast.success(t("toasts.statusUpdated", { status: next.replace("_", " ") }));
      } catch {
        toast.error(t("toasts.statusUpdateError"));
      }
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        await deleteActionItem(item.id);
        toast.success(t("toasts.itemDeleted"));
      } catch {
        toast.error(t("toasts.deleteError"));
      }
    });
  }

  const icons: Record<string, React.ReactNode> = {
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
    in_progress: <Play className="h-4 w-4 text-status-progress" />,
    completed: <CheckCircle2 className="h-4 w-4 text-win" />,
  };

  const dateStr = formatDate(item.sessionDate, locale, "short-compact");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3">
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
        aria-label="Toggle action item status"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : icons[item.status]}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            item.status === "completed" ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.description}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {item.topic && (
            <Badge variant="secondary" className="text-xs">
              {item.topic}
            </Badge>
          )}
          <Link
            href={`/coaching/${item.sessionId}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            {item.coachName} · {dateStr}
          </Link>
        </div>
      </div>
      <Badge
        variant={
          item.status === "completed"
            ? "default"
            : item.status === "in_progress"
              ? "secondary"
              : "outline"
        }
        className="shrink-0 text-xs"
      >
        {item.status.replace("_", " ")}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Delete action item"
      >
        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function ActionItemsClient({ items }: ActionItemsClientProps) {
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("ActionItems");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))] as string[];

  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (topicFilter !== "all" && item.topic !== topicFilter) return false;
    return true;
  });

  // Clamp page if filters reduce result count
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = paginate(filtered, safePage);

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const completedCount = items.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("summary", { pendingCount, inProgressCount, completedCount })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder={t("statusFilterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="in_progress">{t("inProgress")}</SelectItem>
            <SelectItem value="completed">{t("completed")}</SelectItem>
          </SelectContent>
        </Select>
        {topics.length > 0 && (
          <Select
            value={topicFilter}
            onValueChange={(v) => {
              setTopicFilter(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by topic">
              <SelectValue placeholder={t("topicFilterPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTopics")}</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 py-16 text-center">
          <ListChecks className="mb-3 h-8 w-8 text-gold" />
          <p className="text-lg font-medium">
            {items.length === 0 ? t("emptyStateTitle") : t("noFilterMatch")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0 ? t("emptyStateDescription") : t("noFilterMatchDescription")}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <ActionItemRow key={item.id} item={item} locale={locale} />
            ))}
          </div>
          <Pagination currentPage={safePage} totalItems={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
