import { db } from "@/db";
import { coachingSessions, coachingActionItems, type CoachingSession } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, GraduationCap, ChevronRight } from "lucide-react";

export default async function CoachingListPage() {
  const user = await requireUser();

  // Parallel: sessions + action items (both only need user.id)
  const [sessions, allActionItems] = await Promise.all([
    db.query.coachingSessions.findMany({
      where: eq(coachingSessions.userId, user.id),
      orderBy: desc(coachingSessions.date),
    }),
    db.query.coachingActionItems.findMany({
      where: eq(coachingActionItems.userId, user.id),
    }),
  ]);

  const actionItemsBySession = new Map<number, { total: number; completed: number }>();
  for (const item of allActionItems) {
    const existing = actionItemsBySession.get(item.sessionId) || { total: 0, completed: 0 };
    existing.total++;
    if (item.status === "completed") existing.completed++;
    actionItemsBySession.set(item.sessionId, existing);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">
            Coaching Sessions
          </h1>
          <p className="text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} logged.
          </p>
        </div>
        <Link href="/coaching/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <GraduationCap className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No coaching sessions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Log your first coaching session to start tracking your improvement.
          </p>
          <Link href="/coaching/new" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session: CoachingSession) => {
            const topics: string[] = session.topics
              ? JSON.parse(session.topics)
              : [];
            const items = actionItemsBySession.get(session.id);
            const dateStr = new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(session.date);

            return (
              <Link key={session.id} href={`/coaching/${session.id}`}>
                <Card className="hover:bg-surface-elevated transition-colors cursor-pointer hover-lift">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-5 w-5 text-gold shrink-0" />
                        <div>
                          <CardTitle className="text-base">
                            {session.coachName}
                          </CardTitle>
                          <CardDescription>
                            {dateStr}
                            {session.durationMinutes &&
                              ` · ${session.durationMinutes} min`}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    {items && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {items.completed}/{items.total} action items completed
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
