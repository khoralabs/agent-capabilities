import { describe, expect, test } from "bun:test";
import {
  type CapabilityLinkField,
  diffAffordancePolicyIds,
  diffCapabilityLinks,
  diffPolicyEvaluationSnapshots,
  diffToolRefs,
  explainCapabilityLinkRelationship,
  formatHashShort,
} from "./capability-diff.js";
import type { CapabilityLink } from "./capability-link.js";

describe("formatHashShort", () => {
  test("abbreviates long hex", () => {
    const h = "a".repeat(64);
    expect(formatHashShort(h)).toBe("aaaaaa…aaaaaa");
  });
  test("returns short strings as-is", () => {
    expect(formatHashShort("abc")).toBe("abc");
  });
  test("empty string", () => {
    expect(formatHashShort("")).toBe("");
  });
});

describe("diffToolRefs", () => {
  test("detects only-in-first, only-in-second, hash changed", () => {
    const a = [
      { toolKey: "x", toolHash: "01" },
      { toolKey: "y", toolHash: "02" },
    ];
    const b = [
      { toolKey: "y", toolHash: "99" },
      { toolKey: "z", toolHash: "03" },
    ];
    const d = diffToolRefs(a, b);
    expect(d.onlyInFirst).toEqual([{ toolKey: "x", toolHash: "01" }]);
    expect(d.onlyInSecond).toEqual([{ toolKey: "z", toolHash: "03" }]);
    expect(d.hashChanged).toEqual([{ toolKey: "y", firstHash: "02", secondHash: "99" }]);
  });
});

describe("diffCapabilityLinks", () => {
  test("all unchanged when equal", () => {
    const x: CapabilityLink = {
      agentId: "a",
      agentName: "A",
      staticHash: "s",
      runtimeHash: "r",
      toolRefs: [],
    };
    const d = diffCapabilityLinks(x, { ...x });
    expect(d.changed).toEqual([]);
    const allFields: CapabilityLinkField[] = [
      "agentId",
      "agentName",
      "staticHash",
      "runtimeHash",
      "invocationHash",
    ];
    expect([...d.unchanged].sort()).toEqual([...allFields].sort());
  });

  test("lists changed fields", () => {
    const a: CapabilityLink = {
      agentId: "a",
      agentName: "A",
      staticHash: "s1",
      runtimeHash: "r1",
      toolRefs: [],
    };
    const b: CapabilityLink = { ...a, runtimeHash: "r2" };
    const d = diffCapabilityLinks(a, b);
    expect(d.unchanged).not.toContain("runtimeHash");
    expect(d.changed.map((c) => c.field)).toContain("runtimeHash");
  });
});

describe("diffPolicyEvaluationSnapshots", () => {
  test("detects only-in-first, only-in-second, value changed", () => {
    const d = diffPolicyEvaluationSnapshots(
      { mode: "hint", results: { a: true, b: false } },
      { mode: "hint", results: { b: true, c: false } },
    );
    expect(d.onlyInFirst).toEqual([{ policyId: "a", allowed: true }]);
    expect(d.onlyInSecond).toEqual([{ policyId: "c", allowed: false }]);
    expect(d.valueChanged).toEqual([{ policyId: "b", first: false, second: true }]);
  });
});

describe("diffAffordancePolicyIds", () => {
  test("detects tool only on one side and policy id changes", () => {
    const d = diffAffordancePolicyIds(
      { x: { policyIds: ["p1"] }, y: { policyIds: ["p1", "p2"] } },
      { y: { policyIds: ["p2", "p3"] }, z: { policyIds: [] } },
    );
    expect(d.onlyInFirst).toEqual(["x"]);
    expect(d.onlyInSecond).toEqual(["z"]);
    expect(d.changed).toEqual([{ toolName: "y", added: ["p3"], removed: ["p1"] }]);
  });
});

describe("explainCapabilityLinkRelationship", () => {
  const base = (): CapabilityLink => ({
    agentId: "a",
    agentName: "A",
    staticHash: "s",
    runtimeHash: "r",
    toolRefs: [],
  });

  test("same", () => {
    const x = base();
    expect(explainCapabilityLinkRelationship(x, { ...x })).toBe("Same capability link.");
  });

  test("different agent id", () => {
    expect(
      explainCapabilityLinkRelationship(base(), {
        ...base(),
        agentId: "b",
      }),
    ).toBe("Different agent ids.");
  });

  test("same static different runtime", () => {
    expect(
      explainCapabilityLinkRelationship(base(), {
        ...base(),
        runtimeHash: "r2",
      }),
    ).toContain("runtime differs");
  });

  test("different static", () => {
    expect(
      explainCapabilityLinkRelationship(base(), {
        ...base(),
        staticHash: "s2",
      }),
    ).toContain("static capabilities");
  });

  test("same static and runtime but different invocationHash", () => {
    expect(
      explainCapabilityLinkRelationship(base(), {
        ...base(),
        invocationHash: "i2",
      }),
    ).toContain("invocation context");
  });
});
