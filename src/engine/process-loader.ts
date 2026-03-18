/**
 * Agent OS — Process Loader
 *
 * Reads YAML process definitions and registers them in the database.
 * Process definitions are the source of truth — the DB stores runtime state.
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export interface ProcessDefinition {
  name: string;
  id: string;
  version: number;
  status: string;
  description: string;
  trigger: {
    type: string;
    cron?: string;
    event?: string;
    description?: string;
    also?: { type: string; event?: string; description?: string };
  };
  inputs: Array<{
    name: string;
    type: string;
    source: string;
    required: boolean;
    description?: string;
  }>;
  steps: Array<{
    id: string;
    name: string;
    executor: string;
    agent_role?: string;
    description?: string;
    inputs?: string[];
    outputs?: string[];
    depends_on?: string[];
    parallel_group?: string;
    verification?: string[];
    commands?: string[];
    config?: Record<string, unknown>;
    harness?: string;
    on_failure?: string;
    handoff_to?: string;
    handoff_at_step?: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    destination: string;
    description?: string;
  }>;
  quality_criteria: string[];
  feedback: {
    metrics: Array<{
      name: string;
      description: string;
      target: string;
    }>;
    capture: string[];
  };
  trust: {
    initial_tier: string;
    upgrade_path: Array<{
      after: string;
      upgrade_to: string;
    }>;
    downgrade_triggers: string[];
  };
}

/**
 * Load a single YAML process definition from file
 */
export function loadProcessFile(filePath: string): ProcessDefinition {
  const content = fs.readFileSync(filePath, "utf-8");
  return YAML.parse(content) as ProcessDefinition;
}

/**
 * Load all process definitions from the processes/ directory
 */
export function loadAllProcesses(
  processDir: string = path.join(process.cwd(), "processes")
): ProcessDefinition[] {
  const files = fs
    .readdirSync(processDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  return files.map((f) => loadProcessFile(path.join(processDir, f)));
}

/**
 * Sync process definitions to the database.
 * Creates new records or updates existing ones.
 */
export async function syncProcessesToDb(
  definitions: ProcessDefinition[]
): Promise<void> {
  for (const def of definitions) {
    const existing = await db
      .select()
      .from(schema.processes)
      .where(eq(schema.processes.slug, def.id))
      .limit(1);

    const trustTier = def.trust.initial_tier.replace(
      "-",
      "_"
    ) as typeof schema.trustTierEnum.enumValues[number];

    if (existing.length > 0) {
      // Update existing process
      await db
        .update(schema.processes)
        .set({
          name: def.name,
          description: def.description,
          version: def.version,
          definition: def as unknown as Record<string, unknown>,
          status: def.status as typeof schema.processStatusEnum.enumValues[number],
          trustTier,
          updatedAt: new Date(),
        })
        .where(eq(schema.processes.slug, def.id));

      console.log(`  Updated: ${def.name} (v${def.version})`);
    } else {
      // Create new process
      await db.insert(schema.processes).values({
        name: def.name,
        slug: def.id,
        description: def.description,
        version: def.version,
        definition: def as unknown as Record<string, unknown>,
        status: def.status as typeof schema.processStatusEnum.enumValues[number],
        trustTier,
      });

      console.log(`  Created: ${def.name} (v${def.version})`);
    }
  }
}
