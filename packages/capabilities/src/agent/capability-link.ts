import { computeInvocationContextHash } from "../hashing/invocation-context.js";
import {
  computeRuntimeHash,
  computeRuntimeCapabilitiesFromEvaluation,
} from "../hashing/runtime-hashes.js";
import type { ToolSpec } from "../tool/types.js";
import type { Composable, ToolkitContext } from "../toolkit/types.js";
import type { RegisteredAgent } from "./types.js";

/**
 * Pure attribution record: links a template (static) fingerprint, effective capability
 * (runtime), and an optional per-invocation binding (subject, policy, etc.).
 */
export type CapabilityLink = {
  agentId: string;
  agentName: string;
  staticHash: string;
  runtimeHash: string;
  /** When set, hashes host-supplied invocation context; omitted when not provided or empty. */
  invocationHash?: string;
};

export type CreateCapabilityLinkArgs = {
  agent: RegisteredAgent;
  /** Tool names enabled this turn (e.g. `Object.keys(evaluated.tools)`). */
  enabledToolNames: string[];
  /** From {@link collectToolStaticHashes} on the root composable. */
  nameToStaticHash: Map<string, string>;
  /** For dynamic-only tools not in the static map. */
  tools: Record<string, ToolSpec>;
  /**
   * Optional per-tool runtime bindings (e.g. provenance head hex for `memory_search`), folded into
   * each tool’s effective {@link computeRuntimeHash} / {@link resolveRuntimeToolRefs} hash.
   */
  runtimeToolAugments?: Readonly<Record<string, string>>;
  /**
   * Per-invocation slice (e.g. subject, persona, `contextVersion`) to fingerprint separately
   * from `staticHash` and `runtimeHash`. Must be a plain object at the root. Optional.
   */
  invocationContext?: unknown;
  /** If set, only these top-level keys of `invocationContext` are hashed. */
  invocationContextAllowlist?: string[];
};

export async function createCapabilityLink(args: CreateCapabilityLinkArgs): Promise<CapabilityLink> {
  const runtimeHash = await computeRuntimeHash(
    args.enabledToolNames,
    args.nameToStaticHash,
    args.tools,
    args.runtimeToolAugments,
  );
  const invocationHash = await computeInvocationContextHash(args.invocationContext, {
    allowlist: args.invocationContextAllowlist,
  });
  const out: CapabilityLink = {
    agentId: args.agent.agentId,
    agentName: args.agent.name,
    staticHash: args.agent.staticHash,
    runtimeHash,
  };
  if (invocationHash !== undefined) {
    out.invocationHash = invocationHash;
  }
  return out;
}

/**
 * One-shot: evaluate the agent’s root composable, then build an {@link CapabilityLink} including
 * optional `invocationHash` (reuses a single `collectToolStaticHashes` / evaluation pass).
 */
export async function computeFullCapabilityLink<Env = unknown>(args: {
  agent: RegisteredAgent;
  ctx: ToolkitContext<Env>;
  runtimeToolAugments?: Readonly<Record<string, string>>;
  invocationContext?: unknown;
  invocationContextAllowlist?: string[];
}): Promise<{
  link: CapabilityLink;
  runtimeHash: string;
  toolRefs: Array<{ toolKey: string; toolHash: string }>;
  nameToStaticHash: Map<string, string>;
  evaluatedTools: Record<string, ToolSpec>;
}> {
  const aug = args.runtimeToolAugments;
  const { runtimeHash, toolRefs, evaluatedTools, nameToStaticHash } =
    await computeRuntimeCapabilitiesFromEvaluation(
      args.agent.rootComposable as Composable<
        { kind: string; name: string },
        Record<string, ToolSpec>,
        Env
      >,
      args.ctx,
      aug !== undefined ? { runtimeToolAugments: aug } : undefined,
    );
  const link = await createCapabilityLink({
    agent: args.agent,
    enabledToolNames: Object.keys(evaluatedTools),
    nameToStaticHash,
    tools: evaluatedTools,
    runtimeToolAugments: aug,
    invocationContext: args.invocationContext,
    invocationContextAllowlist: args.invocationContextAllowlist,
  });
  return { link, runtimeHash, toolRefs, nameToStaticHash, evaluatedTools };
}
