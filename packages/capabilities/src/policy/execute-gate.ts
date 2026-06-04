import type { ToolSpec } from "../tool/types.js";
import type { ToolkitContext } from "../toolkit/types.js";
import type {
  PolicyExecuteBinding,
  PolicyResultMap,
  SharedPolicy,
  ToolPipelineHooks,
} from "./types.js";

export type GateToolPoliciesAtExecuteArgs = {
  spec: ToolSpec;
  runtime: {
    env: unknown;
    namespace?: string;
    agentId?: string;
    agentName?: string;
    resolvedPolicies?: PolicyResultMap;
    /** Frozen results by policy id (replay / cross-process). */
    policyResults?: Record<string, boolean>;
    /** When `authoritative`, snapshot policies deny if id missing from cache. */
    policySnapshotMode?: "authoritative" | "hint";
    pipelineHooks?: import("./types.js").ToolPipelineHooks;
  };
};

function snapshotResult(
  policy: SharedPolicy,
  resolved: PolicyResultMap | undefined,
  policyResults: Record<string, boolean> | undefined,
): boolean | undefined {
  if (resolved?.has(policy)) {
    return resolved.get(policy) ?? false;
  }
  if (policyResults !== undefined && policy.id in policyResults) {
    return policyResults[policy.id] ?? false;
  }
  return undefined;
}

async function evaluateLivePolicyAtExecute(
  policy: SharedPolicy,
  ctx: ToolkitContext,
  resolvedMut: PolicyResultMap,
  hooks: ToolPipelineHooks | undefined,
  toolName: string,
): Promise<boolean> {
  let ok = false;
  let error: string | undefined;
  try {
    ok = await policy.evaluate(ctx.env);
    if (!ok) {
      error = `Policy denied: ${policy.id}`;
    }
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
  }
  resolvedMut.set(policy, ok);
  await hooks?.onPolicyEvaluated?.({
    ok,
    policyId: policy.id,
    error,
    env: ctx.env,
    phase: "execute",
    toolName,
  });
  return ok;
}

/**
 * Enforces tool policies at the host execute boundary (e.g. AI SDK `execute`).
 * `snapshot` policies reuse {@link PolicyResultMap} / `policyResults`; `live` policies always re-evaluate.
 */
export async function gateToolPoliciesAtExecute(
  args: GateToolPoliciesAtExecuteArgs,
): Promise<void> {
  const { spec, runtime } = args;
  const policies = spec.policies ?? [];
  if (policies.length === 0) {
    return;
  }

  const resolved = runtime.resolvedPolicies;
  const authoritative = runtime.policySnapshotMode === "authoritative";

  const ctx: ToolkitContext = {
    env: runtime.env,
    namespace: runtime.namespace,
    agentId: runtime.agentId,
    agentName: runtime.agentName,
    pipelineHooks: runtime.pipelineHooks,
  };

  const resolvedMut = resolved ?? new Map<SharedPolicy, boolean>();

  for (const p of policies) {
    const binding: PolicyExecuteBinding = p.executeBinding ?? "live";

    if (binding === "snapshot") {
      const cached = snapshotResult(p, resolved, runtime.policyResults);
      if (cached !== undefined) {
        if (!cached) {
          throw new Error(`Policy denied: ${p.id}`);
        }
        continue;
      }
      if (authoritative) {
        throw new Error(`Policy denied: ${p.id} (authoritative snapshot, no cached result)`);
      }
    }

    const ok = await evaluateLivePolicyAtExecute(
      p,
      ctx,
      resolvedMut,
      runtime.pipelineHooks,
      spec.name,
    );
    if (!ok) {
      throw new Error(`Policy denied: ${p.id}`);
    }
  }
}
