/**
 * Tests for @ditto/core duration parser (Brief 121 AC1/AC2).
 */

import { describe, it, expect } from "vitest";
import { parseDuration, isValidDuration } from "./duration";

describe("parseDuration", () => {
  it("AC1: parses hours correctly", () => {
    expect(parseDuration("4h")).toBe(4 * 60 * 60 * 1000); // 14400000
    expect(parseDuration("4h")).toBe(14400000);
  });

  it("AC1: parses days correctly", () => {
    expect(parseDuration("3d")).toBe(3 * 24 * 60 * 60 * 1000); // 259200000
    expect(parseDuration("3d")).toBe(259200000);
    expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000); // 604800000
    expect(parseDuration("7d")).toBe(604800000);
  });

  it("AC1: parses weeks correctly", () => {
    expect(parseDuration("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000); // 1209600000
    expect(parseDuration("2w")).toBe(1209600000);
  });

  it("AC1: parses minutes correctly", () => {
    expect(parseDuration("30m")).toBe(30 * 60 * 1000);
  });

  it("parses single-digit values", () => {
    expect(parseDuration("1h")).toBe(3600000);
    expect(parseDuration("1d")).toBe(86400000);
    expect(parseDuration("1w")).toBe(604800000);
  });

  it("AC2: throws on invalid format", () => {
    expect(() => parseDuration("invalid")).toThrow("Invalid duration format");
    expect(() => parseDuration("")).toThrow("Invalid duration format");
    expect(() => parseDuration("4x")).toThrow("Invalid duration format");
    expect(() => parseDuration("h4")).toThrow("Invalid duration format");
    expect(() => parseDuration("4.5h")).toThrow("Invalid duration format");
    expect(() => parseDuration("-4h")).toThrow("Invalid duration format");
    expect(() => parseDuration("04h")).toThrow("Invalid duration format");
    expect(() => parseDuration("007d")).toThrow("Invalid duration format");
  });

  it("AC2: error message is descriptive", () => {
    try {
      parseDuration("bad");
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("bad");
      expect((e as Error).message).toContain("Expected");
    }
  });
});

describe("isValidDuration", () => {
  it("returns true for valid durations", () => {
    expect(isValidDuration("4h")).toBe(true);
    expect(isValidDuration("3d")).toBe(true);
    expect(isValidDuration("2w")).toBe(true);
    expect(isValidDuration("30m")).toBe(true);
  });

  it("returns false for invalid durations", () => {
    expect(isValidDuration("invalid")).toBe(false);
    expect(isValidDuration("")).toBe(false);
    expect(isValidDuration("4x")).toBe(false);
  });
});
