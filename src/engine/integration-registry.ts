/**
 * Ditto — Integration Registry
 *
 * Loads integration declarations from YAML files in the integrations/ directory.
 * Each file declares a service and its available protocol interfaces.
 * Pattern: Mirrors process-loader (YAML → typed definitions).
 *
 * Provenance: ADR-005 (integration architecture), Insight-007 (declarations vs state)
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";

// ============================================================
// Types
// ============================================================

export interface CliInterface {
  command: string;
  auth?: string;
  env_vars?: string[];
}

export interface McpInterface {
  uri: string;
  auth?: string;
}

export interface RestInterface {
  base_url: string;
  auth?: string;
  headers?: Record<string, string>;
}

export interface IntegrationDefinition {
  service: string;
  description: string;
  interfaces: {
    cli?: CliInterface;
    mcp?: McpInterface;
    rest?: RestInterface;
  };
  preferred: "cli" | "mcp" | "rest";
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate an integration definition has all required fields.
 * Returns error messages (empty array = valid).
 */
export function validateIntegration(def: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!def.service || typeof def.service !== "string") {
    errors.push("Missing or invalid 'service' field");
  }
  if (!def.description || typeof def.description !== "string") {
    errors.push("Missing or invalid 'description' field");
  }
  if (!def.interfaces || typeof def.interfaces !== "object") {
    errors.push("Missing or invalid 'interfaces' field");
    return errors; // Can't validate further
  }

  const ifaces = def.interfaces as Record<string, unknown>;
  const hasInterface = ifaces.cli || ifaces.mcp || ifaces.rest;
  if (!hasInterface) {
    errors.push("At least one interface (cli, mcp, rest) is required");
  }

  // Validate CLI interface if present
  if (ifaces.cli) {
    const cli = ifaces.cli as Record<string, unknown>;
    if (!cli.command || typeof cli.command !== "string") {
      errors.push("CLI interface missing 'command' field");
    }
  }

  // Validate MCP interface if present
  if (ifaces.mcp) {
    const mcp = ifaces.mcp as Record<string, unknown>;
    if (!mcp.uri || typeof mcp.uri !== "string") {
      errors.push("MCP interface missing 'uri' field");
    }
  }

  // Validate REST interface if present
  if (ifaces.rest) {
    const rest = ifaces.rest as Record<string, unknown>;
    if (!rest.base_url || typeof rest.base_url !== "string") {
      errors.push("REST interface missing 'base_url' field");
    }
  }

  if (!def.preferred || typeof def.preferred !== "string") {
    errors.push("Missing or invalid 'preferred' field");
  } else if (!["cli", "mcp", "rest"].includes(def.preferred as string)) {
    errors.push(`Invalid preferred protocol: ${def.preferred}`);
  } else if (ifaces && !(ifaces as Record<string, unknown>)[def.preferred as string]) {
    errors.push(`Preferred protocol '${def.preferred}' has no matching interface`);
  }

  return errors;
}

// ============================================================
// Loading
// ============================================================

/**
 * Load a single integration YAML file.
 */
export function loadIntegrationFile(filePath: string): IntegrationDefinition {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = YAML.parse(content) as Record<string, unknown>;

  const errors = validateIntegration(parsed);
  if (errors.length > 0) {
    throw new Error(
      `Invalid integration file ${path.basename(filePath)}:\n  ${errors.join("\n  ")}`
    );
  }

  return parsed as unknown as IntegrationDefinition;
}

/**
 * Load all integration definitions from the integrations/ directory.
 * Skips schema files (00-*.yaml).
 */
export function loadAllIntegrations(
  integrationDir: string = path.join(process.cwd(), "integrations")
): IntegrationDefinition[] {
  if (!fs.existsSync(integrationDir)) {
    return [];
  }

  const files = fs
    .readdirSync(integrationDir)
    .filter(
      (f) =>
        (f.endsWith(".yaml") || f.endsWith(".yml")) &&
        !f.startsWith("00-") // Skip schema files
    );

  return files.map((f) => loadIntegrationFile(path.join(integrationDir, f)));
}

// ============================================================
// Registry (in-memory lookup)
// ============================================================

let registryCache: Map<string, IntegrationDefinition> | null = null;

/**
 * Get the integration registry (loads on first call, caches after).
 */
export function getIntegrationRegistry(
  integrationDir?: string
): Map<string, IntegrationDefinition> {
  if (!registryCache) {
    const defs = loadAllIntegrations(integrationDir);
    registryCache = new Map(defs.map((d) => [d.service, d]));
  }
  return registryCache;
}

/**
 * Look up an integration by service name.
 */
export function getIntegration(
  service: string,
  integrationDir?: string
): IntegrationDefinition | undefined {
  return getIntegrationRegistry(integrationDir).get(service);
}

/**
 * Clear the registry cache (used in tests and after sync).
 */
export function clearRegistryCache(): void {
  registryCache = null;
}
