"use client";

/**
 * Ditto Typing Indicator
 *
 * Three-dot pulse animation with optional status text.
 * Matches frontdoor iMessage/WhatsApp pattern.
 *
 * Provenance: welcome/typing-indicator.tsx pattern, Brief 094.
 */

interface TypingIndicatorProps {
  status?: string;
}

export function TypingIndicator({ status }: TypingIndicatorProps) {
  return (
    <div className="max-w-[720px] mx-auto py-3">
      <div className="flex items-center gap-3 animate-fade-in">
        {/* Three-dot pulse — iMessage style */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-text-muted"
              style={{
                animation: "pulse-dot 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        {/* Status text — "Considering...", "Reading your processes..." */}
        {status && (
          <span className="text-sm text-text-muted italic">{status}</span>
        )}
      </div>
    </div>
  );
}
