import { describe, expect, test } from "bun:test";
import { createRegisteredAgent } from "../agent/registered-agent.js";
import { collectToolStaticHashes, computeRuntimeHash } from "../hashing/runtime-hashes.js";
import { policy } from "../policy/policy.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { evaluateComposable, toolkit } from "../toolkit/toolkit.js";
import {
  AGENT_SNAPSHOT_ENVELOPE_VERSION,
  captureAgentRuntimeSnapshot,
  captureAgentSnapshotEnvelope,
} from "./capture-turn.js";

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

describe("captureAgentSnapshotEnvelope", () => {
  test("golden path: envelope schemaVersion, link hashes, toolRefs, wire affordances", async () => {
    const t = tool({
      name: "echo",
      inputSchema: schema,
      handler: async (_c, i) => i.n,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a1",
      name: "Agent",
      instructions: [],
      rootComposable: graph,
    });

    const { envelope, link, toolRefs, evaluatedTools } = await captureAgentSnapshotEnvelope({
      agent,
      ctx: { env: {} },
    });

    expect(envelope.schemaVersion).toBe(AGENT_SNAPSHOT_ENVELOPE_VERSION);
    expect(envelope.static?.agentId).toBe("a1");
    const runtime = envelope.runtime;
    if (!runtime) throw new Error("expected envelope.runtime");
    expect(runtime.link).toEqual(link);
    expect(link.runtimeHash).toBe(runtime.link.runtimeHash);
    expect(link.toolRefs).toEqual(toolRefs);
    expect(link.toolRefs).toEqual(runtime.toolRefs);
    expect(toolRefs).toEqual(runtime.toolRefs);
    expect(Object.keys(envelope.runtime?.affordances.tools ?? {})).toEqual(["echo"]);
    expect(evaluatedTools.echo).toBeDefined();
  });

  test("invocationContext sets invocationHash on link", async () => {
    const t = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });

    const without = await captureAgentSnapshotEnvelope({ agent, ctx: { env: {} } });
    const withInv = await captureAgentSnapshotEnvelope({
      agent,
      ctx: { env: {} },
      invocationContext: { subjectId: "user-1" },
    });

    expect(without.link.invocationHash).toBeUndefined();
    expect(withInv.link.invocationHash).toBeDefined();
    expect(withInv.link.invocationHash).not.toBe(without.link.runtimeHash);
  });
});

describe("captureAgentRuntimeSnapshot", () => {
  test("policy results captured from single evaluation pass", async () => {
    const gate = policy("tier-pro", async (env: { tier: string }) =>
      Promise.resolve(env.tier === "pro"),
    );
    const gated = tool({
      name: "proOnly",
      inputSchema: schema,
      policies: [gate],
      handler: async () => 1,
    });
    const graph = toolkit([gated], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });

    const allowed = await captureAgentRuntimeSnapshot({
      agent,
      ctx: { env: { tier: "pro" } },
      policyMode: "authoritative",
    });
    expect(allowed.runtime.policy.results["tier-pro"]).toBe(true);
    expect(allowed.evaluatedTools.proOnly).toBeDefined();

    const blocked = await captureAgentRuntimeSnapshot({
      agent,
      ctx: { env: { tier: "free" } },
      policyMode: "authoritative",
    });
    expect(blocked.runtime.policy.results["tier-pro"]).toBe(false);
    expect(blocked.evaluatedTools.proOnly).toBeUndefined();
    expect(blocked.link.runtimeHash).not.toBe(allowed.link.runtimeHash);
  });

  test("live tools runnable and static instructions merged", async () => {
    const t = tool({
      name: "add",
      inputSchema: schema,
      handler: async (_c, i) => i.n + 1,
    });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: ["Agent-level line."],
      rootComposable: graph,
    });

    const { instructions, evaluatedTools } = await captureAgentRuntimeSnapshot({
      agent,
      ctx: { env: {} },
    });

    expect(instructions).toContain("Agent-level line.");
    const out = await evaluatedTools.add?.handler({ env: {} }, { n: 2 });
    expect(out).toBe(3);
  });

  test("runtimeHash matches manual computeRuntimeHash for same evaluation", async () => {
    const t = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const graph = toolkit([t], { name: "root" });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });
    const ctx = { env: {} };

    const captured = await captureAgentRuntimeSnapshot({ agent, ctx });
    const evaluated = await evaluateComposable(graph, ctx);
    const nameToStaticHash = await collectToolStaticHashes(graph);
    const expected = await computeRuntimeHash(
      Object.keys(evaluated.tools),
      nameToStaticHash,
      evaluated.tools,
    );
    expect(captured.link.runtimeHash).toBe(expected);
  });
});
