import type { PolicyResultMap, SharedPolicy, ToolPipelineHooks } from "../policy/types.js";
import type { StandardSchemaV1 } from "../standard-schema.js";

/**
 * Per-invocation context passed to {@link ToolSpec.handler} and AI SDK adapters.
 * Pass the same `env` and {@link PolicyResultMap} from `evaluateComposable` when using snapshot policies.
 */
export type ToolRuntimeContext<Env = unknown> = {
  env: Env;
  namespace?: string;
  agentId?: string;
  agentName?: string;
  /** Session cancellation signal (conventional; set by {@link createAgentRegistry} when configured). */
  abortSignal?: AbortSignal;
  /** From `evaluateComposable(..., { resolvedPolicies })` — shared with snapshot-bound policies. */
  resolvedPolicies?: PolicyResultMap;
  /** Frozen policy id → allowed (replay); used when policy objects are not shared in-process. */
  policyResults?: Record<string, boolean>;
  /** When `authoritative`, snapshot policies without a cache entry deny at execute. */
  policySnapshotMode?: "authoritative" | "hint";
  /** Optional hooks for `live` / fallback policy evaluation at execute (`phase: "execute"`). */
  pipelineHooks?: ToolPipelineHooks;
};

/**
 * Runtime tool shape. {@link ToolSpec.handler} uses {@link ToolRuntimeContext} with erased
 * {@code env} so merged tool maps stay compositional; use {@link tool}’s {@code Env} generic for a
 * typed handler at definition time.
 */
export type ToolSpec = {
  name: string;
  description?: string;
  inputSchema: StandardSchemaV1;
  instructions: string;
  /** Sorted policy ids gating this tool (for runtime hashing parity with static tool hash). */
  policyIds?: string[];
  /**
   * Same {@link SharedPolicy} instances as the defining composable.
   * Execute-time enforcement uses {@link PolicyExecuteBinding} and {@link ToolRuntimeContext.resolvedPolicies}.
   */
  policies?: SharedPolicy[];
  handler: (
    ctx: ToolRuntimeContext<unknown>,
    input: unknown,
    options?: unknown,
  ) => Promise<unknown> | AsyncIterable<unknown>;
};
