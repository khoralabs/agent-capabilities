import { expect, test } from "bun:test";
import type { PolicyResultMap, ToolRuntimeContext, ToolSpec } from "@khoralabs/agent-capabilities";
import { evaluateComposable, policy, tool, toolkit } from "@khoralabs/agent-capabilities";
import z from "zod";
import { toolMapToAiTools, toolSpecToAiTool } from "./tool-spec-to-ai-sdk.js";

test("live policy (default) re-evaluates on each AI SDK execute", async () => {
  let policyEvalCount = 0;
  let allow = true;
  const p = policy("gate", async () => {
    policyEvalCount++;
    return allow;
  });

  const spec: ToolSpec = {
    name: "noop",
    inputSchema: z.object({}).strict(),
    instructions: "",
    policyIds: ["gate"],
    policies: [p],
    handler: async () => "done",
  };

  const runtime: ToolRuntimeContext = { env: {} };
  const aiTool = toolSpecToAiTool(spec, runtime);
  const execute = aiTool.execute;
  if (typeof execute !== "function") {
    throw new Error("expected AI tool execute");
  }

  const toolOpts = {
    toolCallId: "capabilities-adapters-policy-test",
    messages: [],
  } as never;

  await execute({}, toolOpts);
  expect(policyEvalCount).toBe(1);

  allow = false;
  expect(execute({}, toolOpts)).rejects.toThrow("Policy denied: gate");
  expect(policyEvalCount).toBe(2);
});

test("snapshot policy does not re-evaluate when resolvedPolicies is shared", async () => {
  let policyEvalCount = 0;
  const gate = policy(
    "gate",
    async () => {
      policyEvalCount++;
      return true;
    },
    { executeBinding: "snapshot" },
  );

  const add = tool({
    name: "add",
    inputSchema: z.object({ n: z.number() }),
    policies: [gate],
    handler: async (_c, i) => i.n + 1,
  });
  const root = toolkit([add], { name: "root" });
  const resolved: PolicyResultMap = new Map();
  const ctx = { env: {} };
  const result = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });
  expect(policyEvalCount).toBe(1);

  const runtime: ToolRuntimeContext = { env: {}, resolvedPolicies: resolved };
  const aiTools = toolMapToAiTools(result.tools, runtime);
  const execute = aiTools.add?.execute;
  if (typeof execute !== "function") {
    throw new Error("expected add execute");
  }

  policyEvalCount = 0;
  await execute({ n: 1 }, {
    toolCallId: "snap-test",
    messages: [],
  } as never);
  expect(policyEvalCount).toBe(0);
});
