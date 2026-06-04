import { describe, expect, test } from "bun:test";
import { collectToolStaticHashes, computeRuntimeHash } from "../hashing/runtime-hashes.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { evaluateComposable, toolkit } from "../toolkit/toolkit.js";
import { computeFullCapabilityLink, createCapabilityLink } from "./capability-link.js";
import { createRegisteredAgent } from "./registered-agent.js";

const schema: StandardSchemaV1<{ n: number }> = {
  "~standard": {
    version: 1,
    vendor: "test",
    types: { input: {} as { n: number }, output: {} as { n: number } },
    validate: (v) =>
      typeof v === "object" && v !== null && "n" in v && typeof (v as { n: unknown }).n === "number"
        ? { value: v as { n: number } }
        : { issues: [{ message: "bad" }] },
  },
};

describe("createCapabilityLink", () => {
  test("links static and runtime hashes for same evaluation", async () => {
    const t = tool({
      name: "t",
      inputSchema: schema,
      handler: async () => 0,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "Agent",
      instructions: [],
      rootComposable: graph,
    });
    const evaluated = await evaluateComposable(graph, { env: {} });
    const nameToStaticHash = await collectToolStaticHashes(graph);
    const enabled = Object.keys(evaluated.tools);
    const runtimeHash = await computeRuntimeHash(enabled, nameToStaticHash, evaluated.tools);
    const link = await createCapabilityLink({
      agent,
      enabledToolNames: enabled,
      nameToStaticHash,
      tools: evaluated.tools,
    });

    expect(link.agentId).toBe("a");
    expect(link.agentName).toBe("Agent");
    expect(link.staticHash).toMatch(/^[a-f0-9]{64}$/);
    expect(link.runtimeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(link.runtimeHash).toBe(runtimeHash);
    expect(link.invocationHash).toBeUndefined();
  });

  test("sets invocationHash when invocationContext is non-empty", async () => {
    const t = tool({
      name: "t",
      inputSchema: schema,
      handler: async () => 0,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "Agent",
      instructions: [],
      rootComposable: graph,
    });
    const evaluated = await evaluateComposable(graph, { env: {} });
    const nameToStaticHash = await collectToolStaticHashes(graph);
    const link = await createCapabilityLink({
      agent,
      enabledToolNames: Object.keys(evaluated.tools),
      nameToStaticHash,
      tools: evaluated.tools,
      invocationContext: { subjectId: "s1" },
    });
    expect(link.invocationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("computeFullCapabilityLink returns link with same runtime as computeRuntimeHash", async () => {
    const t = tool({
      name: "t",
      inputSchema: schema,
      handler: async () => 0,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "Agent",
      instructions: [],
      rootComposable: graph,
    });
    const { link, runtimeHash, evaluatedTools } = await computeFullCapabilityLink({
      agent,
      ctx: { env: {} },
      invocationContext: { n: 1 },
    });
    const nameToStaticHash = await collectToolStaticHashes(graph);
    const expected = await computeRuntimeHash(
      Object.keys(evaluatedTools),
      nameToStaticHash,
      evaluatedTools,
    );
    expect(link.runtimeHash).toBe(expected);
    expect(link.runtimeHash).toBe(runtimeHash);
    expect(link.invocationHash).toBeDefined();
  });

  test("runtimeToolAugments changes runtime hash for bound tool", async () => {
    const t = tool({
      name: "memory_search",
      inputSchema: schema,
      handler: async () => 0,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "Agent",
      instructions: [],
      rootComposable: graph,
    });
    const ctx = { env: {} };
    const first = await computeFullCapabilityLink({
      agent,
      ctx,
      runtimeToolAugments: { memory_search: "hex_a" },
    });
    const second = await computeFullCapabilityLink({
      agent,
      ctx,
      runtimeToolAugments: { memory_search: "hex_b" },
    });
    expect(first.runtimeHash).not.toBe(second.runtimeHash);
    expect(first.link.runtimeHash).toBe(first.runtimeHash);
    const refA = first.toolRefs.find((r) => r.toolKey === "memory_search")?.toolHash;
    const refB = second.toolRefs.find((r) => r.toolKey === "memory_search")?.toolHash;
    expect(refA).toBeDefined();
    expect(refA).not.toBe(refB);
  });

  test("runtime hash differs for empty vs non-empty enabled tools", async () => {
    const t = tool({
      name: "t",
      inputSchema: schema,
      handler: async () => 0,
    });
    const graph = toolkit([t], { name: "root" });
    const nameToStaticHash = await collectToolStaticHashes(graph);
    const evaluated = await evaluateComposable(graph, { env: {} });
    const hWithTools = await computeRuntimeHash(
      Object.keys(evaluated.tools),
      nameToStaticHash,
      evaluated.tools,
    );
    const hEmpty = await computeRuntimeHash([], nameToStaticHash, {});
    expect(hWithTools).not.toBe(hEmpty);
  });
});
