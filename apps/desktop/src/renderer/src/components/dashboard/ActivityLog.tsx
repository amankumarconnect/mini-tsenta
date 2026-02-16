import { useEffect, useRef, JSX } from "react";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";

// Interface for log entry structure.
export interface LogEntry {
  message: string; // The text content of the log.
  type: "info" | "success" | "error" | "skip" | "match"; // Log severity/type.
  jobTitle?: string; // Optional job title associated with the log.
  matchScore?: number; // Optional match score (0-100).
  timestamp: Date; // Time of the log event.
}

interface ActivityLogProps {
  logs: LogEntry[]; // Array of logs to display.
}

// Sub-component to visualize the match score as a progress bar.
function MatchScoreBar({
  score,
  type,
}: {
  score: number;
  type: LogEntry["type"];
}): JSX.Element {
  // Determine if the score is good based on the log type.
  const isGood = type === "success" || type === "match";

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        {/* Progress bar fill */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isGood ? "bg-emerald-500" : "bg-destructive", // Green for good, red for bad.
          )}
          style={{ width: `${Math.min(score, 100)}%` }} // Visual width.
        />
      </div>
      {/* Percentage text */}
      <span
        className={cn(
          "text-[10px] font-bold tabular-nums min-w-[32px] text-right",
          isGood ? "text-emerald-500" : "text-destructive",
        )}
      >
        {score}%
      </span>
    </div>
  );
}

// Sub-component to render the appropriate icon for a log type.
function LogIcon({ type }: { type: LogEntry["type"] }): JSX.Element {
  const baseClass = "size-1.5 rounded-full shrink-0 mt-[5px]";

  switch (type) {
    case "success":
    case "match":
      return <div className={cn(baseClass, "bg-emerald-500")} />; // Green dot.
    case "error":
    case "skip":
      return <div className={cn(baseClass, "bg-destructive")} />; // Red dot.
    default:
      return <div className={cn(baseClass, "bg-muted-foreground/40")} />; // Grey dot.
  }
}

// Sub-component to render a single log row.
function LogEntryRow({ log }: { log: LogEntry }): JSX.Element {
  // Check if log is related to a job context (skip, success, match).
  const hasJobContext =
    log.jobTitle &&
    (log.type === "skip" || log.type === "success" || log.type === "match");
  const hasScore = log.matchScore !== undefined && log.matchScore >= 0;
  const isGood = log.type === "success" || log.type === "match";
  const isBad = log.type === "skip" || log.type === "error";

  // Render a detailed card for job-related logs.
  if (hasJobContext) {
    return (
      <div
        className={cn(
          "rounded-lg border p-2.5 transition-colors",
          isGood && "border-emerald-500/30 bg-emerald-500/5",
          isBad && "border-destructive/30 bg-destructive/5",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Job Title */}
          <p className="text-xs font-medium break-words min-w-0 flex-1">
            {log.jobTitle}
          </p>
          {/* Badge indicating Match or Skip */}
          <Badge
            variant={isGood ? "default" : "destructive"}
            className={cn(
              "shrink-0 text-[10px] px-1.5 py-0",
              isGood && "bg-emerald-500 hover:bg-emerald-500",
            )}
          >
            {isGood ? "Match" : "Skip"}
          </Badge>
        </div>
        {/* Log Message */}
        <p
          className={cn(
            "text-[11px] mt-0.5",
            isGood
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {log.message}
        </p>
        {/* Match Score Bar (if applicable) */}
        {hasScore && <MatchScoreBar score={log.matchScore!} type={log.type} />}
      </div>
    );
  }

  // Render a simple list item for general logs.
  return (
    <div className="flex items-start gap-2 px-1 py-0.5">
      <LogIcon type={log.type} />
      <p className="min-w-0 flex-1 text-xs break-words">
        <span
          className={cn(
            log.type === "error" && "text-destructive",
            log.type === "success" && "text-emerald-600 dark:text-emerald-400",
            log.type === "info" && "text-muted-foreground",
          )}
        >
          {log.message}
        </span>
        {/* Optional job title for general logs if present */}
        {log.jobTitle && (
          <span className="text-[10px] text-muted-foreground/70 ml-1 italic">
            — {log.jobTitle}
          </span>
        )}
      </p>
      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
        {log.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}

// Main component to check activity logs with auto-scroll.
export function ActivityLog({ logs }: ActivityLogProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever new logs are added.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header with counts */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold">Activity Log</h3>
        {logs.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {
              logs.filter((l) => l.type === "success" || l.type === "match")
                .length
            }{" "}
            matched
            {" / "}
            {logs.filter((l) => l.type === "skip").length} skipped
          </span>
        )}
      </div>
      {/* Scrollable area for logs */}
      <ScrollArea className="flex-1 rounded-md border bg-muted/30">
        <div className="p-2 space-y-1.5">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground">
                No activity yet. Start the automation to see logs.
              </p>
            </div>
          ) : (
            logs.map((log, i) => <LogEntryRow key={i} log={log} />)
          )}
          {/* Invisible element to scroll to */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
