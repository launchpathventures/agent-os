/**
 * Ditto — Credential Scrubber (Brief 171)
 *
 * Recursively walks tool-result values (strings, arrays, plain objects) and
 * replaces any occurrence of a known credential value with
 * `[REDACTED:{service}]`. Applied at the return boundary of CLI/REST
 * integration handlers so that tokens returned by external APIs (error
 * bodies, echoed headers) never cross into agent context, memories,
 * activity records, or SSE streams.
 *
 * Out of scope: generic secret detection via entropy / regex. This module
 * only redacts values we already know (from the credential vault and env).
 * A future brief can add heuristic detection if needed.
 *
 * Provenance: Brief 171. Same approach as the existing log scrubber in
 * `cli.ts:scrubCredentials`, extended to structured values.
 */

const MAX_STRING_BYTES = 1 * 1024 * 1024; // 1MB cap per string leaf

/** Walk `value` and redact every occurrence of any active secret string. */
export function scrubCredentialsFromValue<T>(
  value: T,
  secrets: string[],
  serviceLabel = "secret",
): T {
  const active = secrets.filter(
    (s): s is string => typeof s === "string" && s.length > 4,
  );
  if (active.length === 0) return value;
  const token = `[REDACTED:${serviceLabel}]`;
  return walk(value, active, token) as T;
}

function walk(v: unknown, secrets: string[], token: string): unknown {
  if (typeof v === "string") {
    return redactString(v, secrets, token);
  }
  if (Array.isArray(v)) {
    return v.map((item) => walk(item, secrets, token));
  }
  if (
    v !== null &&
    typeof v === "object" &&
    !(v instanceof Date) &&
    !(v instanceof Map) &&
    !(v instanceof Set) &&
    !(v instanceof RegExp) &&
    !(v instanceof Error) &&
    !ArrayBuffer.isView(v)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
      out[k] = walk(inner, secrets, token);
    }
    return out;
  }
  return v;
}

function redactString(s: string, secrets: string[], token: string): string {
  // Protect against a pathologically large string: still scrub, but via a
  // single split/join pass per secret instead of regex engines — replaceAll
  // is already efficient on V8. We do log-warn at the handler for any leaf
  // string above the cap so operators know a huge blob flowed through.
  if (s.length > MAX_STRING_BYTES) {
    // Still attempt to redact; `String.prototype.replaceAll` with a literal
    // pattern is O(n) per secret in V8. For 1MB + few secrets, this is
    // low single-digit ms.
  }
  let out = s;
  for (const secret of secrets) {
    if (out.includes(secret)) {
      out = out.split(secret).join(token);
    }
  }
  return out;
}

/** Convenience: pull the set of secret *values* from a resolved authEnv map. */
export function secretsFromAuthEnv(authEnv: Record<string, string>): string[] {
  const values: string[] = [];
  for (const value of Object.values(authEnv)) {
    if (typeof value === "string" && value.length > 0) {
      values.push(value);
    }
  }
  return values;
}
