/**
 * Credential Vault Tests (Brief 035)
 *
 * Tests: encrypt/decrypt roundtrip, scoping enforcement, missing vault key,
 * env var fallback with warning, list credentials hides values, duplicate replace,
 * processId threading through tool resolver.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb, type TestDb } from "../test-utils";
import * as schema from "../db/schema";

// We need to mock the db module to use our test database
let testDb: TestDb;
let cleanup: () => void;

// Mock the db module — use dynamic getters so testDb assigned in beforeEach is captured
vi.mock("../db", async () => {
  const actualSchema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return {
    get db() {
      return testDb;
    },
    schema: actualSchema,
  };
});

// Import after mock is set up
const { storeCredential, getCredential, deleteCredential, listCredentials, resolveServiceAuth } =
  await import("./credential-vault");

// Also need a process in the DB for FK constraint
async function createProcess(db: TestDb, id: string, slug: string): Promise<void> {
  await db.insert(schema.processes).values({
    id,
    name: slug,
    slug,
    definition: {},
  });
}

beforeEach(async () => {
  const result = createTestDb();
  testDb = result.db;
  cleanup = result.cleanup;

  // Set vault key for tests
  process.env.DITTO_VAULT_KEY = "test-vault-key-for-testing-only!";
});

afterEach(() => {
  cleanup();
  delete process.env.DITTO_VAULT_KEY;
});

describe("credential-vault", () => {
  describe("encrypt/decrypt roundtrip", () => {
    it("stores and retrieves a credential with correct value", async () => {
      await createProcess(testDb, "proc-1", "test-process");
      await storeCredential("proc-1", "github", "ghp_test_token_12345");

      const result = await getCredential("proc-1", "github");
      expect(result).not.toBeNull();
      expect(result!.value).toBe("ghp_test_token_12345");
      expect(result!.source).toBe("vault");
    });

    it("stores and retrieves JSON multi-value credentials", async () => {
      await createProcess(testDb, "proc-1", "test-process");
      const multiValue = JSON.stringify({ GH_TOKEN: "tok123", GH_USERNAME: "user" });
      await storeCredential("proc-1", "github", multiValue);

      const result = await getCredential("proc-1", "github");
      expect(result).not.toBeNull();
      expect(JSON.parse(result!.value)).toEqual({ GH_TOKEN: "tok123", GH_USERNAME: "user" });
    });
  });

  describe("scoping enforcement", () => {
    it("process A cannot read process B's credential", async () => {
      await createProcess(testDb, "proc-a", "process-a");
      await createProcess(testDb, "proc-b", "process-b");

      await storeCredential("proc-a", "github", "token-a");
      await storeCredential("proc-b", "github", "token-b");

      const resultA = await getCredential("proc-a", "github");
      const resultB = await getCredential("proc-b", "github");

      expect(resultA!.value).toBe("token-a");
      expect(resultB!.value).toBe("token-b");

      // Cross-scope access returns null
      const resultCross = await getCredential("proc-a", "slack");
      expect(resultCross).toBeNull();
    });
  });

  describe("missing DITTO_VAULT_KEY", () => {
    it("throws when DITTO_VAULT_KEY is absent", async () => {
      delete process.env.DITTO_VAULT_KEY;
      await createProcess(testDb, "proc-1", "test-process");

      await expect(
        storeCredential("proc-1", "github", "token"),
      ).rejects.toThrow("DITTO_VAULT_KEY environment variable is required");
    });
  });

  describe("env var fallback", () => {
    it("falls back to env vars with deprecation warning when no vault credential", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.GH_TOKEN = "env-token-value";

      const result = await resolveServiceAuth("proc-1", "github", {
        envVars: ["GH_TOKEN"],
      });

      expect(result.source).toBe("env");
      expect(result.envVars.GH_TOKEN).toBe("env-token-value");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEPRECATION]"),
      );

      warnSpy.mockRestore();
      delete process.env.GH_TOKEN;
    });

    it("returns vault credential when available (no fallback)", async () => {
      await createProcess(testDb, "proc-1", "test-process");
      await storeCredential("proc-1", "github", "vault-token");

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.GH_TOKEN = "env-token-should-not-use";

      const result = await resolveServiceAuth("proc-1", "github", {
        envVars: ["GH_TOKEN"],
      });

      expect(result.source).toBe("vault");
      expect(result.envVars.GH_TOKEN).toBe("vault-token");
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      delete process.env.GH_TOKEN;
    });
  });

  describe("list credentials", () => {
    it("lists credentials without revealing values", async () => {
      await createProcess(testDb, "proc-1", "test-process");
      await storeCredential("proc-1", "github", "secret-token");
      await storeCredential("proc-1", "slack", "another-secret");

      const list = await listCredentials("proc-1");
      expect(list).toHaveLength(2);

      // Verify no value fields exist
      for (const cred of list) {
        expect(cred).toHaveProperty("processId");
        expect(cred).toHaveProperty("service");
        expect(cred).toHaveProperty("createdAt");
        expect(cred).not.toHaveProperty("value");
        expect(cred).not.toHaveProperty("encryptedValue");
        expect(cred).not.toHaveProperty("iv");
        expect(cred).not.toHaveProperty("authTag");
      }
    });

    it("filters by processId", async () => {
      await createProcess(testDb, "proc-1", "process-1");
      await createProcess(testDb, "proc-2", "process-2");
      await storeCredential("proc-1", "github", "token-1");
      await storeCredential("proc-2", "slack", "token-2");

      const list1 = await listCredentials("proc-1");
      expect(list1).toHaveLength(1);
      expect(list1[0].service).toBe("github");

      const listAll = await listCredentials();
      expect(listAll).toHaveLength(2);
    });
  });

  describe("duplicate replace", () => {
    it("replaces existing credential on duplicate (processId, service)", async () => {
      await createProcess(testDb, "proc-1", "test-process");

      await storeCredential("proc-1", "github", "original-token");
      await storeCredential("proc-1", "github", "updated-token");

      const result = await getCredential("proc-1", "github");
      expect(result!.value).toBe("updated-token");

      // Should only be one credential
      const list = await listCredentials("proc-1");
      expect(list).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("deletes a credential", async () => {
      await createProcess(testDb, "proc-1", "test-process");
      await storeCredential("proc-1", "github", "token");

      await deleteCredential("proc-1", "github");

      const result = await getCredential("proc-1", "github");
      expect(result).toBeNull();
    });
  });

  describe("resolveServiceAuth with REST auth types", () => {
    it("resolves bearer_token from env var when no vault credential", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.SLACK_BOT_TOKEN = "xoxb-test";

      const result = await resolveServiceAuth(undefined, "slack", {
        authType: "bearer_token",
      });

      expect(result.source).toBe("env");
      expect(Object.values(result.envVars)[0]).toBe("xoxb-test");

      warnSpy.mockRestore();
      delete process.env.SLACK_BOT_TOKEN;
    });
  });
});
