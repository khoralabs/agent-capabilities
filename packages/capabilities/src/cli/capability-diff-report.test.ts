import { describe, expect, test } from "bun:test";
import type { CapabilityLink } from "../agent/capability-link.js";
import { createRegisteredAgent } from "../agent/registered-agent.js";
import { policy } from "../policy/policy.js";
import { captureAgentRuntimeSnapshot } from "../snapshot/capture-turn.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { toolkit } from "../toolkit/toolkit.js";
import { formatCapabilityDiffReport } from "./capability-diff-report.js";
import type { DiffSources } from "./parse-diff-input.js";

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

const baseLink = (): CapabilityLink => ({
  agentId: "a",
  agentName: "A",
  staticHash: "s",
  runtimeHash: "r",
  toolRefs: [],
});

function sources(link: CapabilityLink, extra?: Partial<DiffSources>): DiffSources {
  return { link, ...extra };
}

describe("formatCapabilityDiffReport", () => {
  test("identical links", () => {
    const x = baseLink();
    const out = formatCapabilityDiffReport({
      first: sources(x),
      second: sources({ ...x }),
    });
    expect(out).toContain("Same capability link.");
    expect(out).toContain("Tools:");
    expect(out).toContain("Unchanged.");
    expect(out).not.toContain("Removed ");
    expect(out).not.toContain("Added ");
  });

  test("runtime drift", () => {
    const a = baseLink();
    const b: CapabilityLink = {
      ...a,
      runtimeHash: "r2",
      toolRefs: [{ toolKey: "newTool", toolHash: "h2" }],
    };
    const out = formatCapabilityDiffReport({
      first: sources(a),
      second: sources(b),
    });
    expect(out).toContain("runtime differs");
    expect(out).toContain("runtimeHash:");
    expect(out).toContain("Added newTool");
  });

  test("static drift", () => {
    const out = formatCapabilityDiffReport({
      first: sources(baseLink()),
      second: sources({ ...baseLink(), staticHash: "s2" }),
    });
    expect(out).toContain("static capabilities");
    expect(out).toContain("staticHash:");
  });

  test("invocation only", () => {
    const out = formatCapabilityDiffReport({
      first: sources(baseLink()),
      second: sources({ ...baseLink(), invocationHash: "inv2" }),
    });
    expect(out).toContain("invocation context");
    expect(out).toContain("invocationHash:");
  });

  test("policy results from capture (tier gate)", async () => {
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
    const blocked = await captureAgentRuntimeSnapshot({
      agent,
      ctx: { env: { tier: "free" } },
      policyMode: "authoritative",
    });

    const out = formatCapabilityDiffReport({
      first: {
        link: allowed.link,
        policy: allowed.runtime.policy,
        affordances: allowed.runtime.affordances,
      },
      second: {
        link: blocked.link,
        policy: blocked.runtime.policy,
        affordances: blocked.runtime.affordances,
      },
    });

    expect(out).toContain("Policies:");
    expect(out).toContain("tier-pro");
    expect(out).toContain("proOnly");
  });
});
