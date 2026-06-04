/**
 * One-turn capture: AgentSnapshotEnvelope + live tools for the same evaluation.
 * Run: bun run example:capabilities
 */
import {
  AGENT_SNAPSHOT_ENVELOPE_VERSION,
  captureAgentSnapshotEnvelope,
  createRegisteredAgent,
} from "../src/index.js";
import type { StandardSchemaV1 } from "../src/standard-schema.js";
import { tool } from "../src/tool/tool.js";
import { toolkit } from "../src/toolkit/toolkit.js";

const schema: StandardSchemaV1<{ n: number }> = {
  "~standard": {
    version: 1,
    vendor: "example",
    types: { input: {} as { n: number }, output: {} as { n: number } },
    validate: (v) =>
      typeof v === "object" && v !== null && "n" in v && typeof (v as { n: unknown }).n === "number"
        ? { value: v as { n: number } }
        : { issues: [{ message: "bad" }] },
  },
};

const t = tool({
  name: "echo",
  inputSchema: schema,
  handler: async (_c, i) => i.n,
});

const graph = toolkit([t], { name: "demo" });

const { agent } = await createRegisteredAgent({
  agentId: "demo-agent",
  name: "Demo",
  instructions: [],
  rootComposable: graph,
});

const { envelope, link, evaluatedTools } = await captureAgentSnapshotEnvelope({
  agent,
  ctx: { env: {} },
  sessionContext: { messageId: "msg-1" },
});

console.log({
  schemaVersion: envelope.schemaVersion,
  expectedVersion: AGENT_SNAPSHOT_ENVELOPE_VERSION,
  agentId: agent.agentId,
  staticHash: link.staticHash,
  runtimeHash: link.runtimeHash,
  toolNames: Object.keys(evaluatedTools),
});
