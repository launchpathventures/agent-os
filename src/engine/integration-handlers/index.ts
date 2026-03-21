/**
 * Ditto — Integration Protocol Handler Registry
 *
 * Resolves the appropriate protocol handler for an integration step.
 * Currently supports CLI. MCP (Brief 025) and REST (Brief 026) extend this.
 *
 * Provenance: Sim Studio handler registry pattern, ADR-005 multi-protocol resolution
 */

import type { StepExecutionResult } from "../step-executor";
import type { IntegrationDefinition } from "../integration-registry";
import { executeCli } from "./cli";

export interface IntegrationStepConfig {
  service: string;
  command: string;
  protocol?: "cli" | "mcp" | "rest"; // Override preferred protocol
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
      });
    }

    case "mcp":
      throw new Error(
        `MCP protocol not yet implemented (Brief 025). Service: ${config.service}`
      );

    case "rest":
      throw new Error(
        `REST protocol not yet implemented (Brief 026). Service: ${config.service}`
      );

    default:
      throw new Error(`Unknown integration protocol: ${protocol}`);
  }
}
