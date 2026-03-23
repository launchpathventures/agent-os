/**
 * Ditto — CLI Protocol Handler
 *
 * Executes integration commands via CLI (child_process.exec).
 * Extends the script adapter's exec-based pattern with:
 * - Credential resolution via resolveAuth (env vars initially, vault in Brief 026)
 * - Retry with exponential backoff (3 attempts: 1s/2s/4s)
 * - JSON output parsing when possible
 * - Credential scrubbing from logs
 *
 * Provenance: Script adapter (src/adapters/script.ts), ADR-005 CLI-first cost optimisation
 */

import { exec } from "child_process";
import { promisify } from "util";
import type { StepExecutionResult } from "../step-executor";
import type { CliInterface } from "../integration-registry";

type ExecFn = (cmd: string, opts: Record<string, unknown>) => Promise<{ stdout: string; stderr: string }>;

/** Testable exec wrapper — override .fn for testing to avoid mocking promisify(exec) custom symbol. */
export const execAsync = {
  fn: promisify(exec) as ExecFn,
};

const BACKOFF_MS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
const MAX_RETRIES = 3;

/**
 * Resolve authentication for a service.
 * Initially reads from environment variables.
 * Brief 026 swaps this implementation to use the credential vault.
 * Same interface, different backend.
 *
 * @param service - Service name (e.g., "github")
 * @param cliInterface - CLI interface definition with env_vars
 * @param processId - Process ID for per-process credential scoping (used by vault in Brief 026)
 */
export function resolveAuth(
  service: string,
  cliInterface: CliInterface,
  processId?: string,
): Record<string, string> {
  const env: Record<string, string> = {};

  if (cliInterface.env_vars) {
    for (const varName of cliInterface.env_vars) {
      const value = process.env[varName];
      if (value) {
        env[varName] = value;
      }
    }
  }

  return env;
}

/**
 * Scrub known credential env var names from text.
 * Prevents accidental credential exposure in logs.
 * Exported for reuse by REST handler (Brief 025).
 */
export function scrubCredentials(
  text: string,
  authEnv: Record<string, string>,
): string {
  let scrubbed = text;
  for (const [_key, value] of Object.entries(authEnv)) {
    if (value && value.length > 4) {
      scrubbed = scrubbed.replaceAll(value, "[REDACTED]");
    }
  }
  return scrubbed;
}

/**
 * Try to parse output as JSON, return raw string on failure.
 */
function parseOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CliHandlerParams {
  service: string;
  command: string;
  cliInterface: CliInterface;
  timeoutMs?: number;
}

/**
 * Execute a CLI integration command with retry and backoff.
 *
 * AC-5: Executes commands via child_process.exec (same as script adapter)
 * AC-6: Returns structured StepExecutionResult
 * AC-7: Retries on failure (exponential backoff, max 3 attempts, 1s/2s/4s)
 * AC-9: Credentials NOT included in logs
 */
export async function executeCli(
  params: CliHandlerParams,
): Promise<StepExecutionResult> {
  const { service, command, cliInterface, timeoutMs = 120_000 } = params;
  const authEnv = resolveAuth(service, cliInterface);
  const logs: string[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BACKOFF_MS[attempt - 1];
      logs.push(`Retry ${attempt}/${MAX_RETRIES - 1} after ${backoff}ms`);
      await sleep(backoff);
    }

    try {
      logs.push(`$ ${command}`);
      const { stdout, stderr } = await execAsync.fn(command, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, ...authEnv },
      });

      // Scrub credentials from output before logging
      if (stderr) {
        logs.push(`STDERR: ${scrubCredentials(stderr.trim(), authEnv)}`);
      }

      const parsed = parseOutput(stdout);
      const scrubbedStdout = scrubCredentials(
        typeof parsed === "string" ? parsed : JSON.stringify(parsed),
        authEnv,
      );
      logs.push(`Output: ${scrubbedStdout.slice(0, 500)}${scrubbedStdout.length > 500 ? "..." : ""}`);

      return {
        outputs: {
          result: parsed,
          service,
          protocol: "cli",
        },
        confidence: "high",
        logs,
      };
    } catch (error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        code?: number;
        killed?: boolean;
      };
      lastError = error as Error;

      const errorMsg = scrubCredentials(
        execError.stderr || execError.stdout || (error as Error).message,
        authEnv,
      );

      if (execError.killed) {
        logs.push(`TIMEOUT after ${timeoutMs}ms`);
        // Don't retry on timeout
        break;
      }

      logs.push(`FAILED (exit ${execError.code}): ${errorMsg.slice(0, 200)}`);
    }
  }

  // All retries exhausted
  return {
    outputs: {
      error: lastError?.message || "Unknown error",
      service,
      protocol: "cli",
    },
    confidence: "low",
    logs,
  };
}
