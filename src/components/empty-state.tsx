import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component rendered above the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Override the default icon classes (h-8 w-8 text-gold) */
  iconClassName?: string;
  /** Primary message */
  title: string;
  /** Optional secondary description */
  description?: string;
  /** Optional CTA rendered below the description */
  action?: ReactNode;
  /** Additional classes on the outer container */
  className?: string;
}

/**
 * Shared empty-state pattern — dashed-border container with centered
 * icon, title, description, and optional action button.
 */
export function EmptyState({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 py-16 text-center",
        className,
      )}
    >
      {Icon && <Icon className={cn("mb-3 h-8 w-8 text-gold", iconClassName)} />}
      <p className="text-lg font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
