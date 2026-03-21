/**
 * Integration Registry Tests
 *
 * Tests: valid file loading, invalid file rejection,
 * service lookup, missing service lookup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  loadIntegrationFile,
  loadAllIntegrations,
  getIntegration,
  clearRegistryCache,
  validateIntegration,
} from "./integration-registry";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-integration-test-"));
  clearRegistryCache();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  clearRegistryCache();
});

function writeYaml(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("integration-registry", () => {
  describe("loadIntegrationFile", () => {
    it("loads a valid CLI integration file", () => {
      const filePath = writeYaml(
        "github.yaml",
        `
service: github
description: GitHub repository management
interfaces:
  cli:
    command: gh
    auth: cli_login
    env_vars:
      - GH_TOKEN
preferred: cli
`
      );

      const def = loadIntegrationFile(filePath);
      expect(def.service).toBe("github");
      expect(def.description).toBe("GitHub repository management");
      expect(def.interfaces.cli?.command).toBe("gh");
      expect(def.interfaces.cli?.env_vars).toEqual(["GH_TOKEN"]);
      expect(def.preferred).toBe("cli");
    });

    it("throws on invalid file (missing service)", () => {
      const filePath = writeYaml(
        "bad.yaml",
        `
description: No service field
interfaces:
  cli:
    command: test
preferred: cli
`
      );

      expect(() => loadIntegrationFile(filePath)).toThrow(
        /Missing or invalid 'service' field/
      );
    });

    it("throws when preferred protocol has no matching interface", () => {
      const filePath = writeYaml(
        "mismatch.yaml",
        `
service: test
description: Test service
interfaces:
  cli:
    command: test-cli
preferred: mcp
`
      );

      expect(() => loadIntegrationFile(filePath)).toThrow(
        /Preferred protocol 'mcp' has no matching interface/
      );
    });
  });

  describe("loadAllIntegrations", () => {
    it("loads all YAML files except 00-schema", () => {
      writeYaml(
        "00-schema.yaml",
        `
required_fields:
  - service
`
      );
      writeYaml(
        "github.yaml",
        `
service: github
description: GitHub
interfaces:
  cli:
    command: gh
preferred: cli
`
      );
      writeYaml(
        "stripe.yaml",
        `
service: stripe
description: Stripe payments
interfaces:
  cli:
    command: stripe
preferred: cli
`
      );

      const defs = loadAllIntegrations(tmpDir);
      expect(defs).toHaveLength(2);
      expect(defs.map((d) => d.service).sort()).toEqual(["github", "stripe"]);
    });

    it("returns empty array for non-existent directory", () => {
      const defs = loadAllIntegrations("/tmp/does-not-exist-" + Date.now());
      expect(defs).toEqual([]);
    });
  });

  describe("getIntegration", () => {
    it("finds a service by name", () => {
      writeYaml(
        "github.yaml",
        `
service: github
description: GitHub
interfaces:
  cli:
    command: gh
preferred: cli
`
      );

      const def = getIntegration("github", tmpDir);
      expect(def).toBeDefined();
      expect(def!.service).toBe("github");
    });

    it("returns undefined for missing service", () => {
      writeYaml(
        "github.yaml",
        `
service: github
description: GitHub
interfaces:
  cli:
    command: gh
preferred: cli
`
      );

      const def = getIntegration("nonexistent", tmpDir);
      expect(def).toBeUndefined();
    });
  });

  describe("validateIntegration", () => {
    it("returns no errors for valid definition", () => {
      const errors = validateIntegration({
        service: "test",
        description: "Test",
        interfaces: { cli: { command: "test" } },
        preferred: "cli",
      });
      expect(errors).toEqual([]);
    });

    it("catches missing interfaces entirely", () => {
      const errors = validateIntegration({
        service: "test",
        description: "Test",
        preferred: "cli",
      });
      expect(errors.some((e) => e.includes("interfaces"))).toBe(true);
    });

    it("catches empty interfaces object", () => {
      const errors = validateIntegration({
        service: "test",
        description: "Test",
        interfaces: {},
        preferred: "cli",
      });
      expect(errors.some((e) => e.includes("At least one interface"))).toBe(true);
    });
  });
});
