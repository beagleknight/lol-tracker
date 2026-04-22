import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";

interface MarkdownDisplayProps {
  content: string;
  className?: string;
}

export function MarkdownDisplay({ content, className }: MarkdownDisplayProps) {
  return (
    <div className={cn("prose prose-sm prose-invert max-w-none", className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
