/**
 * CLI Protocol Handler Tests
 *
 * Tests: success, failure with retry, timeout, credential scrubbing.
 * Uses the injectable execAsync.fn to avoid mocking promisify(exec).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeCli, resolveAuth, execAsync } from "./cli";
import type { CliInterface } from "../integration-registry";

const testCliInterface: CliInterface = {
  command: "gh",
  auth: "cli_login",
  env_vars: ["GH_TOKEN"],
};

const originalFn = execAsync.fn;

afterEach(() => {
  execAsync.fn = originalFn;
});

describe("cli-handler", () => {
  describe("executeCli", () => {
    it("executes a CLI command and returns JSON output", async () => {
      execAsync.fn = async () => ({
        stdout: '{"number":1,"title":"Test Issue"}',
        stderr: "",
      });

      const result = await executeCli({
        service: "github",
        command: "gh issue list --json number,title",
        cliInterface: testCliInterface,
      });

      expect(result.confidence).toBe("high");
      expect(result.outputs.result).toEqual({ number: 1, title: "Test Issue" });
      expect(result.outputs.service).toBe("github");
      expect(result.outputs.protocol).toBe("cli");
      expect(result.logs).toBeDefined();
      expect(result.logs!.some((l) => l.startsWith("$"))).toBe(true);
    });

    it("returns raw string when output is not JSON", async () => {
      execAsync.fn = async () => ({
        stdout: "plain text output\n",
        stderr: "",
      });

      const result = await executeCli({
        service: "github",
        command: "gh issue view 1",
        cliInterface: testCliInterface,
      });

      expect(result.confidence).toBe("high");
      expect(result.outputs.result).toBe("plain text output");
    });

    it("retries on failure and returns low confidence after exhaustion", async () => {
      execAsync.fn = async () => {
        throw Object.assign(new Error("connection error"), {
          code: 1,
          stderr: "connection error",
          stdout: "",
          killed: false,
        });
      };

      const result = await executeCli({
        service: "github",
        command: "gh issue list",
        cliInterface: testCliInterface,
      });

      expect(result.confidence).toBe("low");
      expect(result.outputs.error).toBeDefined();
      // Should have attempted 3 times (logged 3 command lines)
      const commandLogs = result.logs!.filter((l) => l.startsWith("$"));
      expect(commandLogs).toHaveLength(3);
    }, 15000);

    it("does not retry on timeout (killed)", async () => {
      execAsync.fn = async () => {
        throw Object.assign(new Error("timeout"), {
          code: null,
          stderr: "",
          stdout: "",
          killed: true,
        });
      };

      const result = await executeCli({
        service: "github",
        command: "gh issue list",
        cliInterface: testCliInterface,
      });

      expect(result.confidence).toBe("low");
      expect(result.logs!.some((l) => l.includes("TIMEOUT"))).toBe(true);
      // Should only have 1 attempt (no retry after timeout)
      const commandLogs = result.logs!.filter((l) => l.startsWith("$"));
      expect(commandLogs).toHaveLength(1);
    });
  });

  describe("resolveAuth", () => {
    it("reads env vars when available", () => {
      const original = process.env.GH_TOKEN;
      process.env.GH_TOKEN = "test-token-123";

      try {
        const env = resolveAuth("github", testCliInterface);
        expect(env.GH_TOKEN).toBe("test-token-123");
      } finally {
        if (original !== undefined) {
          process.env.GH_TOKEN = original;
        } else {
          delete process.env.GH_TOKEN;
        }
      }
    });

    it("returns empty object when env vars not set", () => {
      const original = process.env.GH_TOKEN;
      delete process.env.GH_TOKEN;

      try {
        const env = resolveAuth("github", testCliInterface);
        expect(env).toEqual({});
      } finally {
        if (original !== undefined) {
          process.env.GH_TOKEN = original;
        }
      }
    });
  });
});
