# AI SDK policy evaluation

Composable evaluation and Vercel AI SDK `execute` are two boundaries. Policies can behave differently at each boundary via **`executeBinding`** on `policy()`.

## Bindings

| `executeBinding` | At `evaluateComposable` | At AI SDK `execute` |
|------------------|-------------------------|---------------------|
| `"live"` (default) | Evaluated; cached in `PolicyResultMap` | **Re-evaluated** every tool call |
| `"snapshot"` | Evaluated; cached in `PolicyResultMap` | **Uses cache** when `resolvedPolicies` or `policyResults` is passed |

```ts
const tier = policy("tier-pro", checkTier, { executeBinding: "snapshot" });
const rate = policy("rate-limit", checkRate, { executeBinding: "live" });
```

## Shared cache (recommended)

Pass the same map from evaluation into the adapter runtime:

```ts
const resolved: PolicyResultMap = new Map();
const { tools } = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });

const aiTools = toolMapToAiTools(tools, {
  env: ctx.env,
  agentId: ctx.agentId,
  resolvedPolicies: resolved,
});
```

- **Snapshot** policies: no extra `evaluate` on tool calls when the map (or `policyResults`) is present.
- **Live** policies: still run on every `execute` (rate limits, fresh auth, etc.).

## Replay / authoritative snapshot

When policy objects are not shared in-process, pass frozen results from capture:

```ts
toolMapToAiTools(tools, {
  env: ctx.env,
  policyResults: envelope.runtime!.policy.results,
  policySnapshotMode: "authoritative",
});
```

Snapshot policies deny at execute if their id is missing from `policyResults` when mode is `authoritative`.

## Pipeline hooks

`live` (and snapshot fallbacks) emit `onPolicyEvaluated` with `phase: "execute"`. Pass `pipelineHooks` on `ToolRuntimeContext` if you need telemetry at the execute boundary.

See also: [persistence](persistence.md), [packages/capabilities-ai-sdk/README.md](../packages/capabilities-ai-sdk/README.md).
