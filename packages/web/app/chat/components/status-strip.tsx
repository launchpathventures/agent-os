"use client";

/**
 * Status Strip — Persistent header for /chat (Brief 123)
 *
 * Compact, always-visible summary above the conversation:
 * - Left: key metrics (contacted, replied, meetings)
 * - Right: next scheduled action
 * - Collapses to single line on mobile
 */

interface StatusStripProps {
  contacted: number;
  replied: number;
  meetings: number;
  nextAction: string | null;
}

export function StatusStrip({ contacted, replied, meetings, nextAction }: StatusStripProps) {
  const hasMetrics = contacted > 0 || replied > 0 || meetings > 0;

  if (!hasMetrics && !nextAction) return null;

  return (
    <div className="border-b border-border/40 bg-surface/50 backdrop-blur-sm">
      <div className="max-w-[640px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
        {/* Metrics */}
        <div className="flex items-center gap-3 text-text-muted">
          {contacted > 0 && (
            <span>
              <span className="font-medium text-text-secondary">{contacted}</span> contacted
            </span>
          )}
          {replied > 0 && (
            <span>
              <span className="font-medium text-text-secondary">{replied}</span> replied
            </span>
          )}
          {meetings > 0 && (
            <span>
              <span className="font-medium text-text-secondary">{meetings}</span> meeting{meetings !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Next action */}
        {nextAction && (
          <span className="text-text-muted text-xs truncate max-w-[200px]">
            {nextAction}
          </span>
        )}
      </div>
    </div>
  );
}
