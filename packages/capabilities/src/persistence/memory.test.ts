import { describe, expect, test } from "bun:test";
import { createCapabilityLink } from "../agent/capability-link.js";
import { createRegisteredAgent } from "../agent/registered-agent.js";
import { collectToolStaticHashes } from "../hashing/runtime-hashes.js";
import {
  AGENT_SNAPSHOT_ENVELOPE_VERSION,
  captureAgentSnapshotEnvelope,
} from "../snapshot/capture-turn.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { evaluateComposable, toolkit } from "../toolkit/toolkit.js";
import { createMemoryAgentCapabilitiesPersistence } from "./memory.js";
import { recordTurnAttribution } from "./record-turn.js";
import {
  capabilityLinkToRow,
  defaultOpContext,
  envelopeToRow,
  registeredAgentToRegistrationRow,
} from "./row-builders.js";

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

describe("createMemoryAgentCapabilitiesPersistence", () => {
  test("upsert is idempotent for same agentId and staticHash", async () => {
    const p = createMemoryAgentCapabilitiesPersistence();
    const op = defaultOpContext();
    const graph = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });
    const row = registeredAgentToRegistrationRow(agent, op);
    const first = await p.upsertRegisteredAgentSnapshot({ op, row });
    const second = await p.upsertRegisteredAgentSnapshot({
      op,
      row: { ...row, registrationId: "other" },
    });
    expect(second.registrationId).toBe(first.registrationId);
  });

  test("getLatestRegisteredAgentForAgent returns latest row", async () => {
    const p = createMemoryAgentCapabilitiesPersistence();
    const op = defaultOpContext();
    const graph = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });
    await p.upsertRegisteredAgentSnapshot({
      op,
      row: registeredAgentToRegistrationRow(agent, op),
    });
    const got = await p.getLatestRegisteredAgentForAgent({ agentId: "a" });
    expect(got.row?.staticHash).toBe(agent.staticHash);
  });

  test("record and get latest capability link for session", async () => {
    const p = createMemoryAgentCapabilitiesPersistence();
    const op = defaultOpContext();
    const graph = toolkit([tool({ name: "t", inputSchema: schema, handler: async () => 0 })], {
      name: "root",
    });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
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
    });
    const row = capabilityLinkToRow(link, "sess-1", op);
    await p.recordSessionCapabilityLink({ op, link: row });
    const latest = await p.getLatestCapabilityLinkForSession({ sessionId: "sess-1" });
    expect(latest.link?.runtimeHash).toBe(link.runtimeHash);
    const listed = await p.listCapabilityLinksForAgent({ agentId: "a" });
    expect(listed.links.length).toBe(1);
  });

  test("envelope round-trip", async () => {
    const p = createMemoryAgentCapabilitiesPersistence();
    const op = defaultOpContext();
    const graph = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });
    const { envelope } = await captureAgentSnapshotEnvelope({ agent, ctx: { env: {} } });
    const { snapshotId } = await p.recordAffordanceSnapshotEnvelope({
      op,
      row: envelopeToRow(envelope, "sess-1", op),
    });
    const got = await p.getAffordanceSnapshotEnvelope({ snapshotId });
    expect(got.row?.schemaVersion).toBe(AGENT_SNAPSHOT_ENVELOPE_VERSION);
    expect(got.row?.envelope.runtime?.link.agentId).toBe("a");
  });

  test("recordTurnAttribution writes link and envelope", async () => {
    const p = createMemoryAgentCapabilitiesPersistence();
    const op = defaultOpContext();
    const graph = tool({ name: "t", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "a",
      name: "A",
      instructions: [],
      rootComposable: graph,
    });
    const { envelope, link } = await captureAgentSnapshotEnvelope({
      agent,
      ctx: { env: {} },
      sessionContext: { messageId: "m1" },
    });
    const result = await recordTurnAttribution(p, {
      op,
      sessionId: "sess-1",
      link,
      envelope,
    });
    expect(result.linkId).toMatch(/^link_/);
    expect(result.envelopeSnapshotId).toMatch(/^snap_/);
    const latest = await p.getLatestCapabilityLinkForSession({ sessionId: "sess-1" });
    expect(latest.link?.linkId).toBe(result.linkId);
  });
});
