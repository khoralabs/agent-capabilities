/**
 * Evaluate a composable, then map ToolSpec values to Vercel AI SDK tools with policy bindings.
 * Run from packages/capabilities-ai-sdk:
 *   bun run example:evaluate
 *
 * Requires workspace @khoralabs/agent-capabilities (bun install from repo root).
 */

import type { PolicyResultMap } from "@khoralabs/agent-capabilities";
import { evaluateComposable, policy, tool, toolkit } from "@khoralabs/agent-capabilities";
import z from "zod";
import { toolMapToAiTools } from "../src/index.js";

const tierCheck = policy(
  "tier-pro",
  async (env: { tier: string }) => Promise.resolve(env.tier === "pro"),
  { executeBinding: "snapshot" },
);

const add = tool({
  name: "add",
  description: "Add one to a number",
  inputSchema: z.object({ n: z.number() }),
  policies: [tierCheck],
  handler: async (_ctx, input) => input.n + 1,
});

const root = toolkit([add], { name: "demo" });

const resolved: PolicyResultMap = new Map();
const ctx = { env: { tier: "pro" as const }, agentId: "demo", agentName: "Demo" };
const { tools, instructions } = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });

console.log("Instructions:", instructions || "(empty)");
console.log("Evaluated tools:", Object.keys(tools));

const aiTools = toolMapToAiTools(tools, {
  ...ctx,
  resolvedPolicies: resolved,
});

const execute = aiTools.add?.execute;
if (typeof execute !== "function") {
  throw new Error("expected add tool");
}

const result = await execute({ n: 41 }, {
  toolCallId: "example-01",
  messages: [],
} as never);

console.log("AI SDK execute result:", result);
