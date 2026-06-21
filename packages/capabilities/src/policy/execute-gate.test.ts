import { describe, expect, test } from "bun:test";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { gateToolPoliciesAtExecute } from "./execute-gate.js";
import { policy } from "./policy.js";
import type { PolicyResultMap } from "./types.js";

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

describe("gateToolPoliciesAtExecute", () => {
  test("snapshot policy uses resolvedPolicies without re-evaluating at execute", async () => {
    let evalCount = 0;
    const snap = policy(
      "snap",
      async () => {
        evalCount++;
        return true;
      },
      { executeBinding: "snapshot" },
    );
    const t = tool({
      name: "t",
      inputSchema: schema,
      policies: [snap],
      handler: async () => "ok",
    });
    const resolved: PolicyResultMap = new Map();
    const ctx = { env: {} };
    const evaluated = await t.evaluate(ctx, resolved);
    expect(evalCount).toBe(1);
    expect(evaluated.tools.t).toBeDefined();

    evalCount = 0;
    const snapSpec = evaluated.tools.t;
    if (!snapSpec) throw new Error("expected tool t");
    await gateToolPoliciesAtExecute({
      spec: snapSpec,
      runtime: { env: {}, resolvedPolicies: resolved },
    });
    expect(evalCount).toBe(0);
  });

  test("live policy re-evaluates at execute even when resolvedPolicies has entry", async () => {
    let evalCount = 0;
    const live = policy(
      "live",
      async () => {
        evalCount++;
        return true;
      },
      { executeBinding: "live" },
    );
    const t = tool({
      name: "t",
      inputSchema: schema,
      policies: [live],
      handler: async () => "ok",
    });
    const resolved: PolicyResultMap = new Map();
    await t.evaluate({ env: {} }, resolved);
    expect(evalCount).toBe(1);

    const evaluated = await t.evaluate({ env: {} }, resolved);
    const liveSpec = evaluated.tools.t;
    if (!liveSpec) throw new Error("expected tool t");
    evalCount = 0;
    await gateToolPoliciesAtExecute({
      spec: liveSpec,
      runtime: { env: {}, resolvedPolicies: resolved },
    });
    expect(evalCount).toBe(1);
  });

  test("snapshot with authoritative mode denies when policy missing from cache", async () => {
    const snap = policy("snap", async () => true, { executeBinding: "snapshot" });
    const spec = {
      name: "t",
      inputSchema: schema,
      instructions: "",
      policies: [snap],
      handler: async () => "ok",
    };
    await expect(
      gateToolPoliciesAtExecute({
        spec,
        runtime: { env: {}, policySnapshotMode: "authoritative" },
      }),
    ).rejects.toThrow(/authoritative snapshot/);
  });

  test("snapshot can use policyResults by id", async () => {
    const snap = policy("snap", async () => true, { executeBinding: "snapshot" });
    const spec = {
      name: "t",
      inputSchema: schema,
      instructions: "",
      policies: [snap],
      handler: async () => "ok",
    };
    await gateToolPoliciesAtExecute({
      spec,
      runtime: { env: {}, policyResults: { snap: true } },
    });
  });

  test("throws AgentSessionAbortedError when abortSignal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const spec = {
      name: "t",
      inputSchema: schema,
      instructions: "",
      handler: async () => "ok",
    };
    await expect(
      gateToolPoliciesAtExecute({
        spec,
        runtime: { env: {}, abortSignal: controller.signal },
      }),
    ).rejects.toThrow("Agent session aborted");
  });
});
