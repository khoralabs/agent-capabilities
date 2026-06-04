import type { CapabilityLink } from "../agent/capability-link.js";
import { createCapabilityLink } from "../agent/capability-link.js";
import type { RegisteredAgent } from "../agent/types.js";
import { collectToolStaticHashes } from "../hashing/runtime-hashes.js";
import type { PolicyResultMap } from "../policy/types.js";
import type { ToolSpec } from "../tool/types.js";
import { assembleToolkitAgentInstructions } from "../toolkit/assemble-toolkit-instructions.js";
import { evaluateComposable } from "../toolkit/toolkit.js";
import type { Composable, ToolkitContext } from "../toolkit/types.js";
import { affordancesToWire, capturePolicyResults } from "./capture-hydrate.js";
import type {
  AgentRuntimeSnapshot,
  AgentSnapshotEnvelope,
  PolicySnapshotMode,
  RegisteredAgentWire,
} from "./types.js";

/** Current {@link AgentSnapshotEnvelope.schemaVersion} for persistence and migration. */
export const AGENT_SNAPSHOT_ENVELOPE_VERSION = "1";

export function registeredAgentToWire(agent: RegisteredAgent): RegisteredAgentWire {
  return {
    agentId: agent.agentId,
    name: agent.name,
    staticHash: agent.staticHash,
    staticInstructions: [...agent.staticInstructions],
    staticContext: { ...agent.staticContext },
  };
}

/** JSON-safe {@link ToolkitContext} subset (hooks omitted). */
export function toolkitContextToWire<Env>(ctx: ToolkitContext<Env>): Record<string, unknown> {
  const out: Record<string, unknown> = { env: ctx.env };
  if (ctx.namespace !== undefined) out.namespace = ctx.namespace;
  if (ctx.agentId !== undefined) out.agentId = ctx.agentId;
  if (ctx.agentName !== undefined) out.agentName = ctx.agentName;
  return out;
}

export type CaptureAgentTurnArgs<Env = unknown> = {
  agent: RegisteredAgent;
  ctx: ToolkitContext<Env>;
  runtimeToolAugments?: Readonly<Record<string, string>>;
  invocationContext?: unknown;
  invocationContextAllowlist?: string[];
  /** Default `"hint"`. */
  policyMode?: PolicySnapshotMode;
  policyAudit?: {
    capturedAt?: number;
    policyBundleId?: string;
    policyEngineVersion?: string;
  };
};

export type CaptureAgentSnapshotEnvelopeArgs<Env = unknown> = CaptureAgentTurnArgs<Env> & {
  sessionContext?: Record<string, unknown>;
  /** Default `true`. */
  includeStatic?: boolean;
};

export type CaptureAgentTurnResult = {
  runtime: AgentRuntimeSnapshot;
  evaluatedTools: Record<string, ToolSpec>;
  instructions: string;
  link: CapabilityLink;
  toolRefs: Array<{ toolKey: string; toolHash: string }>;
};

export type CaptureAgentSnapshotEnvelopeResult = CaptureAgentTurnResult & {
  envelope: AgentSnapshotEnvelope;
};

async function evaluateAndCaptureTurn<Env>(
  args: CaptureAgentTurnArgs<Env>,
): Promise<CaptureAgentTurnResult> {
  const { agent, ctx } = args;
  const aug = args.runtimeToolAugments;
  const root = agent.rootComposable as Composable<
    { kind: string; name: string },
    Record<string, ToolSpec>,
    Env
  >;

  const resolved: PolicyResultMap = new Map();
  const nameToStaticHash = await collectToolStaticHashes(root);
  const evaluated = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });

  const toolkitBlock = assembleToolkitAgentInstructions(evaluated);
  const agentBlock = agent.staticInstructions
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
  const instructions = [agentBlock, toolkitBlock].filter(Boolean).join("\n\n");

  const evaluatedTools = evaluated.tools;
  const enabledToolNames = Object.keys(evaluatedTools);
  const link = await createCapabilityLink({
    agent,
    enabledToolNames,
    nameToStaticHash,
    tools: evaluatedTools,
    runtimeToolAugments: aug,
    invocationContext: args.invocationContext,
    invocationContextAllowlist: args.invocationContextAllowlist,
  });
  const toolRefs = link.toolRefs;

  const policy = capturePolicyResults(resolved, args.policyMode ?? "hint", args.policyAudit);

  const runtime: AgentRuntimeSnapshot = {
    link,
    toolRefs,
    affordances: affordancesToWire({ tools: evaluatedTools, instructions }),
    policy,
    toolkitContext: toolkitContextToWire(ctx),
  };

  return {
    runtime,
    evaluatedTools,
    instructions,
    link,
    toolRefs,
  };
}

/**
 * One evaluation pass: build {@link AgentRuntimeSnapshot} plus live tools/instructions for the same turn.
 */
export async function captureAgentRuntimeSnapshot<Env = unknown>(
  args: CaptureAgentTurnArgs<Env>,
): Promise<CaptureAgentTurnResult> {
  return evaluateAndCaptureTurn(args);
}

/**
 * One evaluation pass: full {@link AgentSnapshotEnvelope} for persistence plus live tools/instructions.
 */
export async function captureAgentSnapshotEnvelope<Env = unknown>(
  args: CaptureAgentSnapshotEnvelopeArgs<Env>,
): Promise<CaptureAgentSnapshotEnvelopeResult> {
  const turn = await evaluateAndCaptureTurn(args);
  const includeStatic = args.includeStatic !== false;
  const envelope: AgentSnapshotEnvelope = {
    schemaVersion: AGENT_SNAPSHOT_ENVELOPE_VERSION,
    static: includeStatic ? registeredAgentToWire(args.agent) : undefined,
    policy: turn.runtime.policy,
    runtime: turn.runtime,
    context: args.sessionContext,
  };
  return { ...turn, envelope };
}
