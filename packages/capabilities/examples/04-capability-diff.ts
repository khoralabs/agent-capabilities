/**
 * Rich capability-diff demo: capture real envelopes, write JSON, run the CLI.
 *
 * Run from packages/capabilities:
 *   bun run example:diff
 *
 * Then inspect artifacts or re-run diffs:
 *   bun run capability-diff examples/output/diff/pro-tier.json examples/output/diff/free-tier.json \
 *     --label-a pro --label-b free
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCapabilityDiff } from "../src/cli/capability-diff.js";
import {
  captureAgentSnapshotEnvelope,
  createRegisteredAgent,
  formatCapabilityDiffReport,
  policy,
  tool,
  toolkit,
} from "../src/index.js";
import type { AgentSnapshotEnvelope } from "../src/snapshot/types.js";
import { greetInputSchema, numberInputSchema } from "./standard-schema-helpers.js";

const outDir = join(import.meta.dir, "output", "diff");

const tierGate = policy("tier-pro", async (env: { tier: string }) =>
  Promise.resolve(env.tier === "pro"),
);

const echo = tool({
  name: "echo",
  description: "Echo a greeting",
  inputSchema: greetInputSchema(),
  handler: async (_ctx, input) => `Hello, ${input.name}`,
});

const proOnly = tool({
  name: "analytics_export",
  description: "Export analytics (pro tier)",
  inputSchema: numberInputSchema(),
  policies: [tierGate],
  handler: async () => ({ rows: 42 }),
});

const supportGraph = toolkit([echo, proOnly], {
  name: "support-assistant",
  instructions: ["You are a support agent.", "Use tools when appropriate."],
});

async function buildSupportAgent(instructionsSuffix: string) {
  const { agent } = await createRegisteredAgent({
    agentId: "support-v1",
    name: "Support Assistant",
    instructions: ["Company-wide tone: helpful and concise.", instructionsSuffix],
    rootComposable: supportGraph,
  });
  return agent;
}

async function writeEnvelope(name: string, envelope: AgentSnapshotEnvelope) {
  const path = join(outDir, `${name}.json`);
  await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  return path;
}

function banner(title: string) {
  console.log(`\n${"═".repeat(72)}\n  ${title}\n${"═".repeat(72)}\n`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const agent = await buildSupportAgent("");

  // --- 1) Runtime + policy: same static template, different env tier ---
  banner("1) Capture: pro tier vs free tier (runtime + policy drift)");
  const pro = await captureAgentSnapshotEnvelope({
    agent,
    ctx: { env: { tier: "pro" }, agentId: agent.agentId, agentName: agent.name },
    invocationContext: { subjectId: "user-100", tenantId: "acme", personaSlug: "support" },
    sessionContext: { messageId: "msg-pro-1" },
    policyMode: "authoritative",
  });
  const free = await captureAgentSnapshotEnvelope({
    agent,
    ctx: { env: { tier: "free" }, agentId: agent.agentId, agentName: agent.name },
    invocationContext: { subjectId: "user-100", tenantId: "acme", personaSlug: "support" },
    sessionContext: { messageId: "msg-free-1" },
    policyMode: "authoritative",
  });

  const proPath = await writeEnvelope("pro-tier", pro.envelope);
  const freePath = await writeEnvelope("free-tier", free.envelope);
  console.log("Wrote:", proPath);
  console.log("Wrote:", freePath);
  console.log("Pro tools:", Object.keys(pro.evaluatedTools).join(", ") || "(none)");
  console.log("Free tools:", Object.keys(free.evaluatedTools).join(", ") || "(none)");

  console.log("\n--- Programmatic report (formatCapabilityDiffReport) ---\n");
  process.stdout.write(
    formatCapabilityDiffReport({
      first: {
        link: pro.link,
        policy: pro.envelope.runtime?.policy,
        affordances: pro.envelope.runtime?.affordances,
      },
      second: {
        link: free.link,
        policy: free.envelope.runtime?.policy,
        affordances: free.envelope.runtime?.affordances,
      },
      labels: { first: "pro-tier", second: "free-tier" },
    }),
  );

  console.log("--- CLI (same comparison) ---\n");
  const cliCode = await runCapabilityDiff([
    proPath,
    freePath,
    "--label-a",
    "pro-tier",
    "--label-b",
    "free-tier",
  ]);
  if (cliCode !== 0) {
    process.exit(cliCode);
  }

  // --- 2) Invocation binding only: same tier, different subject ---
  banner("2) Capture: same runtime, different invocationContext");
  const subjectA = await captureAgentSnapshotEnvelope({
    agent,
    ctx: { env: { tier: "pro" }, agentId: agent.agentId, agentName: agent.name },
    invocationContext: { subjectId: "user-alice", tenantId: "acme" },
  });
  const subjectB = await captureAgentSnapshotEnvelope({
    agent,
    ctx: { env: { tier: "pro" }, agentId: agent.agentId, agentName: agent.name },
    invocationContext: { subjectId: "user-bob", tenantId: "acme" },
  });

  const alicePath = await writeEnvelope("subject-alice", subjectA.envelope);
  const bobPath = await writeEnvelope("subject-bob", subjectB.envelope);
  await runCapabilityDiff([alicePath, bobPath, "--label-a", "alice", "--label-b", "bob"]);

  // --- 3) Static drift: agent definition changed (extra instruction line) ---
  banner("3) Capture: static template drift (agent instructions changed)");
  const agentV2 = await buildSupportAgent("Escalate billing issues to tier-2.");
  const v1Snap = await captureAgentSnapshotEnvelope({
    agent,
    ctx: { env: { tier: "pro" } },
  });
  const v2Snap = await captureAgentSnapshotEnvelope({
    agent: agentV2,
    ctx: { env: { tier: "pro" } },
  });

  const v1Path = await writeEnvelope("agent-v1-static", v1Snap.envelope);
  const v2Path = await writeEnvelope("agent-v2-static", v2Snap.envelope);
  console.log("v1 staticHash:", v1Snap.link.staticHash.slice(0, 12), "…");
  console.log("v2 staticHash:", v2Snap.link.staticHash.slice(0, 12), "…");
  await runCapabilityDiff([v1Path, v2Path, "--label-a", "v1", "--label-b", "v2"]);

  // --- 4) Identical baseline + JSON output ---
  banner("4) Baseline: identical envelopes (no drift)");
  const baselinePath = await writeEnvelope("baseline", pro.envelope);
  await runCapabilityDiff([baselinePath, baselinePath, "--label-a", "same", "--label-b", "same"]);

  banner("5) Machine-readable (--json) excerpt");
  const jsonCode = await runCapabilityDiff([
    proPath,
    freePath,
    "--json",
    "--label-a",
    "pro",
    "--label-b",
    "free",
  ]);
  if (jsonCode !== 0) {
    process.exit(jsonCode);
  }

  banner("Done");
  console.log(`Artifacts in:\n  ${outDir}\n`);
  console.log("Try:");
  console.log(
    `  bun run capability-diff ${join("examples/output/diff", "pro-tier.json")} ${join("examples/output/diff", "free-tier.json")} --label-a pro --label-b free`,
  );
}

await main();
