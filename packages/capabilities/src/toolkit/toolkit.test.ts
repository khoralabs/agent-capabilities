import { describe, expect, test } from "bun:test";
import { policy } from "../policy/policy.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { dynamicToolkit, evaluateComposable, toolkit } from "./toolkit.js";

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

describe("toolkit evaluation", () => {
  test("dedupes policy evaluation across members", async () => {
    let calls = 0;
    const p = policy("p1", async () => {
      calls += 1;
      return true;
    });

    const a = tool({
      name: "a",
      inputSchema: schema,
      policies: [p],
      handler: async (_c, i) => i.n,
    });
    const b = tool({
      name: "b",
      inputSchema: schema,
      policies: [p],
      handler: async (_c, i) => i.n + 1,
    });

    const tk = toolkit([a, b], { name: "t" });
    await evaluateComposable(tk, { env: {} });
    expect(calls).toBe(1);
  });

  test("toolkit instructions empty when all tools blocked", async () => {
    const p = policy("block", async () => false);
    const t = tool({
      name: "a",
      inputSchema: schema,
      policies: [p],
      handler: async () => 0,
    });
    const tk = toolkit([t], { name: "t", instructions: ["x"] });
    const r = await evaluateComposable(tk, { env: {} });
    expect(r.instructions).toBe("");
    expect(Object.keys(r.tools)).toHaveLength(0);
  });
});

describe("dynamicToolkit", () => {
  test("create() returning empty members yields no tools and empty instructions", async () => {
    const root = dynamicToolkit({
      name: "dyn-empty",
      instructions: ["dynamic line"],
      create: async () => [],
    });
    const r = await evaluateComposable(root, { env: {} });
    expect(Object.keys(r.tools)).toHaveLength(0);
    expect(r.instructions).toBe("");
  });

  test("policy denied at dynamicToolkit phase does not call create()", async () => {
    let createCalled = false;
    const block = policy("block-dynamic", async () => false);
    const root = dynamicToolkit({
      name: "dyn-blocked",
      policies: [block],
      create: async () => {
        createCalled = true;
        const t = tool({
          name: "t",
          inputSchema: schema,
          handler: async () => 0,
        });
        return [t];
      },
    });
    const r = await evaluateComposable(root, { env: {} });
    expect(createCalled).toBe(false);
    expect(Object.keys(r.tools)).toHaveLength(0);
  });

  test("onPolicyEvaluated receives phase dynamicToolkit for toolkit-level policies", async () => {
    const phases: string[] = [];
    const p = policy("allow", async () => true);
    const member = tool({
      name: "m",
      inputSchema: schema,
      handler: async () => 0,
    });
    const root = dynamicToolkit({
      name: "dyn-phase",
      policies: [p],
      hooks: {
        onPolicyEvaluated: (e) => {
          phases.push(e.phase);
        },
      },
      create: async () => [member],
    });
    await evaluateComposable(root, { env: {} });
    expect(phases).toContain("dynamicToolkit");
  });
});
