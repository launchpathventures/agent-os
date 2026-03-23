/**
 * Ditto — Integration Protocol Handler Registry
 *
 * Resolves the appropriate protocol handler for an integration step.
 * Supports CLI (Brief 024) and REST (Brief 025). MCP deferred (Insight-065).
 *
 * Provenance: Sim Studio handler registry pattern, ADR-005 multi-protocol resolution
 */

import type { StepExecutionResult } from "../step-executor";
import type { IntegrationDefinition } from "../integration-registry";
import { executeCli } from "./cli";
import { executeRest } from "./rest";

export interface IntegrationStepConfig {
  service: string;
  command: string;
  protocol?: "cli" | "mcp" | "rest"; // Override preferred protocol
  processId?: string; // Per-process credential scoping (Brief 035)
}

/**
 * Execute an integration step by resolving the protocol handler.
 *
 * Resolution order:
 * 1. Explicit protocol override from step config
 * 2. Preferred protocol from integration registry
 * 3. First available interface
 */
export async function executeIntegration(
  config: IntegrationStepConfig,
  integration: IntegrationDefinition,
): Promise<StepExecutionResult> {
  const protocol = config.protocol || integration.preferred;

  switch (protocol) {
    case "cli": {
      const cliInterface = integration.interfaces.cli;
      if (!cliInterface) {
        throw new Error(
          `Integration '${config.service}' has no CLI interface but protocol is 'cli'`
        );
      }
      return executeCli({
        service: config.service,
        command: config.command,
        cliInterface,
        processId: config.processId,
      });
    }

    case "rest": {
      const restInterface = integration.interfaces.rest;
      if (!restInterface) {
        throw new Error(
          `Integration '${config.service}' has no REST interface but protocol is 'rest'`
        );
      }
      // For integration steps (not tool use), execute as a simple GET
      const { result, logs } = await executeRest({
        service: config.service,
        restInterface,
        method: "GET",
        endpoint: config.command,
        processId: config.processId,
      });
      return {
        outputs: {
          result,
          service: config.service,
          protocol: "rest",
        },
        confidence: "high",
        logs,
      };
    }

    case "mcp":
      throw new Error(
        `MCP protocol deferred (Insight-065). Service: ${config.service}`
      );

    default:
      throw new Error(`Unknown integration protocol: ${protocol}`);
  }
}
