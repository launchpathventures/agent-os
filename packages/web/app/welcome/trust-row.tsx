"use client";

/**
 * Three trust statements in a row.
 * Provenance: DESIGN.md Section 10 Page 1 trust section, Brief 094.
 */
export function TrustRow() {
  const statements = [
    "Nothing goes out without your OK.",
    "Gets better the more you use it.",
    "No setup. Just tell him what you do.",
  ];

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-8">
      {statements.map((s, i) => (
        <p
          key={i}
          className="text-sm font-medium text-text-muted"
        >
          {s}
        </p>
      ))}
    </div>
  );
}
