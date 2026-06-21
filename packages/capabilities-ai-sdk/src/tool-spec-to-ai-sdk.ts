/**
 * Maps evaluated `@khoralabs/agent-capabilities` {@link ToolSpec} into Vercel AI SDK {@link tool}.
 */

import {
  gateToolPoliciesAtExecute,
  type ToolRuntimeContext,
  type ToolSpec,
  throwIfAborted,
} from "@khoralabs/agent-capabilities";
import { type Tool, tool } from "ai";

export function toolSpecToAiTool(
  spec: ToolSpec,
  runtime: ToolRuntimeContext,
): Tool<unknown, unknown> {
  return tool({
    description: spec.description,
    inputSchema: spec.inputSchema as Tool<unknown, unknown>["inputSchema"],
    execute: async (input: unknown, options) => {
      throwIfAborted(runtime.abortSignal);
      await gateToolPoliciesAtExecute({ spec, runtime });
      return spec.handler(runtime, input, options);
    },
  });
}

export function toolMapToAiTools(
  tools: Record<string, ToolSpec>,
  runtime: ToolRuntimeContext,
): Record<string, Tool<unknown, unknown>> {
  const out: Record<string, Tool<unknown, unknown>> = {};
  for (const [key, spec] of Object.entries(tools)) {
    out[key] = toolSpecToAiTool(spec, runtime);
  }
  return out;
}
