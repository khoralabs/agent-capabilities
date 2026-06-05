/**
 * Session host: capture in run, persist in onAfterRun.
 * Run: bun run example:session-attribution
 */
import {
  captureAgentSnapshotEnvelope,
  createAgentRegistry,
  createRegisteredAgent,
  defaultOpContext,
  recordTurnAttribution,
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

const registry = createAgentRegistry();
await registry.register(agent);

type TurnCapture = Awaited<ReturnType<typeof captureAgentSnapshotEnvelope>>;
let lastCapture: TurnCapture | undefined;

const session = registry.createSession(agent.agentId, {
  sessionId: "sess-demo",
  ctx: { traceId: "tr-1", subjectId: "user-1", messageId: "msg-1" },
  run: async ({ agent, context }) => {
    lastCapture = await captureAgentSnapshotEnvelope({
      agent,
      ctx: { env: {}, agentId: agent.agentId },
      invocationContext: {
        traceId: context.traceId as string,
        subjectId: context.subjectId as string,
      },
      sessionContext: { messageId: context.messageId as string },
    });
    return { toolCount: Object.keys(lastCapture.evaluatedTools).length };
  },
  hooks: {
    onAfterRun: async () => {
      if (!lastCapture) return;
      await recordTurnAttribution(registry.persistence, {
        op: defaultOpContext(),
        sessionId: "sess-demo",
        link: lastCapture.link,
        envelope: lastCapture.envelope,
        linkMetadata: { invocationContext: { traceId: "tr-1", subjectId: "user-1" } },
      });
    },
  },
});

const output = await session.start({});
const latest = await registry.persistence.getLatestCapabilityLinkForSession({
  sessionId: "sess-demo",
});

console.log({
  output,
  runtimeHash: lastCapture?.link.runtimeHash,
  persistedLinkId: latest.link?.linkId,
});
