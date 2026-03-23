/**
 * Tests for Agent Tools (Brief 031)
 *
 * Tests write_file tool security, tool subsets, and backward compatibility.
 */

import { describe, it, expect, afterEach } from "vitest";
import { executeTool, readOnlyTools, readWriteTools, toolDefinitions } from "./tools";
import fs from "fs";
import path from "path";
import os from "os";

// Use a temp directory as workDir for tests
const testWorkDir = path.join(os.tmpdir(), `ditto-tools-test-${Date.now()}`);

// Setup and teardown
function setup() {
  fs.mkdirSync(testWorkDir, { recursive: true });
}

function teardown() {
  fs.rmSync(testWorkDir, { recursive: true, force: true });
}

describe("tool subsets", () => {
  it("readOnlyTools contains 3 tools", () => {
    expect(readOnlyTools).toHaveLength(3);
    const names = readOnlyTools.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("search_files");
    expect(names).toContain("list_files");
  });

  it("readWriteTools contains 4 tools", () => {
    expect(readWriteTools).toHaveLength(4);
    const names = readWriteTools.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("search_files");
    expect(names).toContain("list_files");
    expect(names).toContain("write_file");
  });

  it("toolDefinitions is backward compatible (equals readOnlyTools)", () => {
    expect(toolDefinitions).toEqual(readOnlyTools);
  });
});

describe("write_file tool", () => {
  beforeAll(() => setup());
  afterAll(() => teardown());

  it("writes a file and returns confirmation", () => {
    const result = executeTool("write_file", {
      path: "test-output.txt",
      content: "hello\nworld\n",
    }, testWorkDir);

    expect(result).toContain("Written: test-output.txt");
    expect(result).toContain("3 lines");

    // Verify file was actually written
    const written = fs.readFileSync(path.join(testWorkDir, "test-output.txt"), "utf-8");
    expect(written).toBe("hello\nworld\n");
  });

  it("creates parent directories when needed", () => {
    const result = executeTool("write_file", {
      path: "nested/dir/file.txt",
      content: "nested content",
    }, testWorkDir);

    expect(result).toContain("Written: nested/dir/file.txt");
    const written = fs.readFileSync(path.join(testWorkDir, "nested/dir/file.txt"), "utf-8");
    expect(written).toBe("nested content");
  });

  it("rejects writes to secret files", () => {
    const result = executeTool("write_file", {
      path: ".env",
      content: "SECRET=bad",
    }, testWorkDir);

    expect(result).toContain("restricted");
    expect(fs.existsSync(path.join(testWorkDir, ".env"))).toBe(false);
  });

  it("rejects writes to credential files", () => {
    const result = executeTool("write_file", {
      path: "credentials.json",
      content: "{}",
    }, testWorkDir);

    expect(result).toContain("restricted");
  });

  it("rejects writes to key files", () => {
    const result = executeTool("write_file", {
      path: "server.key",
      content: "key data",
    }, testWorkDir);

    expect(result).toContain("restricted");
  });

  it("rejects path traversal", () => {
    const result = executeTool("write_file", {
      path: "../../../etc/passwd",
      content: "bad",
    }, testWorkDir);

    expect(result).toContain("Path traversal rejected");
  });

  it("rejects writes outside workDir via absolute path", () => {
    const result = executeTool("write_file", {
      path: "/tmp/outside.txt",
      content: "bad",
    }, testWorkDir);

    expect(result).toContain("Path traversal rejected");
  });

  it("requires path parameter", () => {
    const result = executeTool("write_file", {
      content: "content",
    }, testWorkDir);

    expect(result).toContain("'path' parameter is required");
  });

  it("requires content parameter", () => {
    const result = executeTool("write_file", {
      path: "test.txt",
    }, testWorkDir);

    expect(result).toContain("'content' parameter is required");
  });
});

// Import beforeAll/afterAll
import { beforeAll, afterAll } from "vitest";
