"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  updateActionItemStatus,
  deleteActionItem,
} from "@/app/actions/coaching";
import { formatDate, DEFAULT_LOCALE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Circle,
  Play,
  CheckCircle2,
  Trash2,
  ListChecks,
} from "lucide-react";
import { Pagination, paginate, PAGE_SIZE } from "@/components/pagination";

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
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function cycleStatus() {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> =
      {
        pending: "in_progress",
        in_progress: "completed",
        completed: "pending",
      };
    const next = nextStatus[item.status];
    startTransition(async () => {
      try {
        await updateActionItemStatus(item.id, next);
        toast.success(`Updated to ${next.replace("_", " ")}.`);
      } catch {
        toast.error("Failed to update status.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this action item? This cannot be undone.")) return;
    startDelete(async () => {
      try {
        await deleteActionItem(item.id);
        toast.success("Action item deleted.");
      } catch {
        toast.error("Failed to delete action item.");
      }
    });
  }

  const icons: Record<string, React.ReactNode> = {
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
    in_progress: <Play className="h-4 w-4 text-yellow-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  };

  const dateStr = formatDate(item.sessionDate, locale, "short-compact");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3 bg-surface-elevated">
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          icons[item.status]
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            item.status === "completed"
              ? "line-through text-muted-foreground"
              : ""
          }`}
        >
          {item.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
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
        className="text-xs shrink-0"
      >
        {item.status.replace("_", " ")}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

export function ActionItemsClient({ items }: ActionItemsClientProps) {
  const { data: authSession } = useSession();
  const locale = authSession?.user?.locale ?? DEFAULT_LOCALE;
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
        <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Action Items</h1>
        <p className="text-muted-foreground">
          {pendingCount} pending · {inProgressCount} in progress ·{" "}
          {completedCount} completed
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        {topics.length > 0 && (
          <Select
            value={topicFilter}
            onValueChange={(v) => { setTopicFilter(v ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
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
          <ListChecks className="h-8 w-8 text-gold mb-3" />
          <p className="text-lg font-medium">
            {items.length === 0
              ? "No action items yet"
              : "No items match your filters"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length === 0
              ? "Create coaching sessions to add action items."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <ActionItemRow key={item.id} item={item} locale={locale} />
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
