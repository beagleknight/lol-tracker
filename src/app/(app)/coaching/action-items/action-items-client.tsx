"use client";

import { Loader2, Circle, Play, CheckCircle2, Trash2, ListChecks, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";

import { updateActionItemStatus, deleteActionItem, createActionItem } from "@/app/actions/coaching";
import { EmptyState } from "@/components/empty-state";
import { Pagination, paginate, PAGE_SIZE } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  sessionId: number | null;
  description: string;
  topicId: number | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  coachName: string | null;
  sessionDate: Date | null;
}

interface OutcomeStats {
  nailed_it: number;
  forgot: number;
  unsure: number;
  total: number;
}

interface ActionItemsClientProps {
  items: ActionItemWithSession[];
  topicNames: { id: number; name: string }[];
  outcomeStats: Record<number, OutcomeStats>;
}

function ActionItemRow({
  item,
  locale,
  topicNames,
  stats,
}: {
  item: ActionItemWithSession;
  locale: string;
  topicNames: { id: number; name: string }[];
  stats?: OutcomeStats;
}) {
  const t = useTranslations("ActionItems");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function cycleStatus() {
    const next: "active" | "completed" = item.status === "active" ? "completed" : "active";
    startTransition(async () => {
      try {
        await updateActionItemStatus(item.id, next);
        toast.success(t("toasts.statusUpdated", { status: next }));
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

  const dateStr = item.sessionDate ? formatDate(item.sessionDate, locale, "short-compact") : null;

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
          {item.topicId && (
            <Badge variant="secondary" className="text-xs">
              {topicNames.find((t) => t.id === item.topicId)?.name ?? `Topic #${item.topicId}`}
            </Badge>
          )}
          {item.sessionId ? (
            <Link
              href={`/coaching/${item.sessionId}`}
              className="text-xs text-muted-foreground hover:underline"
            >
              {item.coachName} · {dateStr}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground italic">{t("standalone")}</span>
          )}
          {stats && stats.total > 0 && (
            <span className="text-xs text-muted-foreground">
              · <span title={t("outcomeNailedIt")}>✅ {stats.nailed_it}</span>{" "}
              <span title={t("outcomeForgot")}>❌ {stats.forgot}</span>{" "}
              <span title={t("outcomeUnsure")}>🤷 {stats.unsure}</span>
            </span>
          )}
        </div>
      </div>
      <Badge
        variant={item.status === "completed" ? "default" : "secondary"}
        className={`shrink-0 text-xs ${
          item.status === "completed"
            ? "border-win/30 bg-win/15 text-win"
            : "border-status-progress/30 bg-status-progress/15 text-status-progress"
        }`}
      >
        {item.status}
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

export function ActionItemsClient({ items, topicNames, outcomeStats }: ActionItemsClientProps) {
  const { user } = useAuth();
  const locale = user?.locale ?? DEFAULT_LOCALE;
  const t = useTranslations("ActionItems");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [isAdding, startAdding] = useTransition();

  const topics = [...new Set(items.map((i) => i.topicId).filter(Boolean))] as number[];

  const filtered = useMemo(() => {
    const result = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (topicFilter !== "all" && item.topicId !== Number(topicFilter)) return false;
      return true;
    });
    if (sortOrder === "newest") {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return result;
  }, [items, statusFilter, topicFilter, sortOrder]);

  // Clamp page if filters reduce result count
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = paginate(filtered, safePage);

  const activeCount = items.filter((i) => i.status === "active").length;
  const completedCount = items.filter((i) => i.status === "completed").length;

  function handleAddItem() {
    if (!newDescription.trim()) return;
    startAdding(async () => {
      try {
        await createActionItem({
          description: newDescription.trim(),
          topicId: newTopic.trim() ? Number(newTopic.trim()) : undefined,
        });
        toast.success(t("toasts.itemCreated"));
        setNewDescription("");
        setNewTopic("");
        setShowAddForm(false);
      } catch {
        toast.error(t("toasts.createError"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gradient-gold text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("summary", { activeCount, completedCount })}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm((prev) => !prev)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("addButton")}
        </Button>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <div className="flex items-end gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Input
              placeholder={t("addDescriptionPlaceholder")}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
            />
          </div>
          <div className="w-36">
            <Select value={newTopic} onValueChange={(v) => setNewTopic(v ?? "")}>
              <SelectTrigger aria-label={t("addTopicPlaceholder")}>
                <SelectValue placeholder={t("addTopicPlaceholder")}>
                  {(value: string) => {
                    const topic = topicNames.find((tn) => String(tn.id) === value);
                    return topic?.name ?? t("addTopicPlaceholder");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {topicNames.map((tn) => (
                  <SelectItem key={tn.id} value={String(tn.id)}>
                    {tn.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleAddItem} disabled={isAdding || !newDescription.trim()}>
            {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("addSubmit")}
          </Button>
        </div>
      )}

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
            <SelectValue placeholder={t("statusFilterPlaceholder")}>
              {(value: string) => {
                const labels: Record<string, string> = {
                  all: t("allStatuses"),
                  active: t("active"),
                  completed: t("completed"),
                };
                return labels[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
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
              <SelectValue placeholder={t("topicFilterPlaceholder")}>
                {(value: string) => {
                  if (value === "all") return t("allTopics");
                  const id = Number(value);
                  return topicNames.find((tn) => tn.id === id)?.name ?? `Topic #${value}`;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTopics")}</SelectItem>
              {topics.map((topicId) => {
                const name =
                  topicNames.find((tn) => tn.id === topicId)?.name ?? `Topic #${topicId}`;
                return (
                  <SelectItem key={topicId} value={String(topicId)}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        <Select
          value={sortOrder}
          onValueChange={(v) => {
            setSortOrder(v as "newest" | "oldest");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label={t("sort.label")}>
            <SelectValue placeholder={t("sort.newestFirst")}>
              {(value: string) => {
                const labels: Record<string, string> = {
                  newest: t("sort.newestFirst"),
                  oldest: t("sort.oldestFirst"),
                };
                return labels[value] ?? value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("sort.newestFirst")}</SelectItem>
            <SelectItem value="oldest">{t("sort.oldestFirst")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={items.length === 0 ? t("emptyStateTitle") : t("noFilterMatch")}
          description={
            items.length === 0 ? t("emptyStateDescription") : t("noFilterMatchDescription")
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                locale={locale}
                topicNames={topicNames}
                stats={outcomeStats[item.id]}
              />
            ))}
          </div>
          <Pagination currentPage={safePage} totalItems={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
