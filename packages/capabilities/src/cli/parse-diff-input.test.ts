import { describe, expect, test } from "bun:test";
import { AGENT_SNAPSHOT_ENVELOPE_VERSION } from "../snapshot/capture-turn.js";
import { extractDiffSources, parseDiffInput } from "./parse-diff-input.js";

describe("parseDiffInput", () => {
  test("accepts CapabilityLink", () => {
    const kind = parseDiffInput({
      agentId: "a",
      agentName: "A",
      staticHash: "s",
      runtimeHash: "r",
    });
    expect(kind.kind).toBe("link");
    if (kind.kind === "link") {
      expect(kind.link.toolRefs).toEqual([]);
    }
  });

  test("accepts envelope v1", () => {
    const kind = parseDiffInput({
      schemaVersion: AGENT_SNAPSHOT_ENVELOPE_VERSION,
      runtime: {
        link: {
          agentId: "a",
          agentName: "A",
          staticHash: "s",
          runtimeHash: "r",
          toolRefs: [],
        },
        toolRefs: [],
        affordances: { instructions: "", tools: {} },
        policy: { mode: "hint", results: {} },
        toolkitContext: { env: {} },
      },
    });
    expect(kind.kind).toBe("envelope");
  });

  test("rejects empty object", () => {
    expect(() => parseDiffInput({})).toThrow(/CapabilityLink|AgentSnapshotEnvelope/);
  });

  test("rejects unknown schemaVersion", () => {
    expect(() => parseDiffInput({ schemaVersion: "99" })).toThrow(/Unsupported schemaVersion/);
  });
});

describe("extractDiffSources", () => {
  test("rejects envelope without runtime.link", () => {
    expect(() =>
      extractDiffSources({
        kind: "envelope",
        envelope: { schemaVersion: AGENT_SNAPSHOT_ENVELOPE_VERSION },
      }),
    ).toThrow(/runtime\.link/);
  });

  test("extracts policy and affordances from runtime", () => {
    const policy = { mode: "hint" as const, results: { p: true } };
    const sources = extractDiffSources({
      kind: "envelope",
      envelope: {
        schemaVersion: AGENT_SNAPSHOT_ENVELOPE_VERSION,
        runtime: {
          link: {
            agentId: "a",
            agentName: "A",
            staticHash: "s",
            runtimeHash: "r",
            toolRefs: [],
          },
          toolRefs: [],
          affordances: { instructions: "hi", tools: {} },
          policy,
          toolkitContext: {},
        },
      },
    });
    expect(sources.policy).toEqual(policy);
    expect(sources.affordances?.instructions).toBe("hi");
  });
});
