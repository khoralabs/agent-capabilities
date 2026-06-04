# @khoralabs/agent-capabilities-ai-sdk

**Beta (0.1.x)** — Vercel AI SDK adapter for evaluated `@khoralabs/agent-capabilities` `ToolSpec` values. Published on npm with the `beta` dist-tag until the adapter API stabilizes alongside core `0.2.x`.

Maps composable evaluation output to AI SDK `tool()` helpers without pulling `ai` into the core package.

## Install

```bash
npm install @khoralabs/agent-capabilities @khoralabs/agent-capabilities-ai-sdk ai
# or: bun add ...
```

Peer dependencies: `@khoralabs/agent-capabilities` `^0.1.0`, `ai` `^6`, TypeScript `^5`.

## When to use

- You evaluate tools with `toolkit` / `evaluateComposable` (or capture) in `@khoralabs/agent-capabilities`.
- You run agents with [Vercel AI SDK](https://sdk.vercel.ai/) `ToolLoopAgent`, `generateText`, or similar.
- You need policy gates at **composable evaluation** and optionally a different behavior at **AI SDK `execute`** (`executeBinding`).

## Quick start

```ts
import { evaluateComposable, policy, tool, toolkit } from "@khoralabs/agent-capabilities";
import type { PolicyResultMap } from "@khoralabs/agent-capabilities";
import { toolMapToAiTools } from "@khoralabs/agent-capabilities-ai-sdk";
import z from "zod";

const gate = policy("tier-pro", async (env: { tier: string }) => env.tier === "pro", {
  executeBinding: "snapshot",
});

const add = tool({
  name: "add",
  inputSchema: z.object({ n: z.number() }),
  policies: [gate],
  handler: async (_ctx, i) => i.n + 1,
});

const root = toolkit([add], { name: "demo" });
const resolved: PolicyResultMap = new Map();
const ctx = { env: { tier: "pro" as const } };

const { tools } = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });

const aiTools = toolMapToAiTools(tools, {
  env: ctx.env,
  resolvedPolicies: resolved,
});

// Pass aiTools to your AI SDK agent / generateText call
```

Runnable example (from this package):

```bash
bun run example:evaluate
```

See also `packages/capabilities/examples/02-dynamic-toolkit.ts` for composable evaluation without AI SDK.

## API

| Export | Role |
|--------|------|
| `toolSpecToAiTool(spec, runtime)` | One `ToolSpec` → AI SDK `Tool` |
| `toolMapToAiTools(tools, runtime)` | Record of specs → record of AI SDK tools |

`runtime` is `ToolRuntimeContext`: at minimum `env`; for policies also `resolvedPolicies`, `policyResults`, and/or `policySnapshotMode`.

## Policies at the execute boundary

Composable evaluation and AI SDK `execute` are separate. Each `policy(id, fn, options?)` can set:

| `executeBinding` | At `evaluateComposable` | At AI SDK `execute` |
|------------------|-------------------------|---------------------|
| `"live"` (default) | Evaluated; cached in `PolicyResultMap` | **Re-evaluated** on every tool call |
| `"snapshot"` | Evaluated; cached | **Uses cache** when `resolvedPolicies` or `policyResults` is passed |

### Shared cache (recommended)

```ts
const resolved: PolicyResultMap = new Map();
const { tools } = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });

const aiTools = toolMapToAiTools(tools, {
  env: ctx.env,
  agentId: ctx.agentId,
  resolvedPolicies: resolved,
});
```

Snapshot policies do not call `evaluate` again on each `execute` when the map is shared. Live policies still run every time (rate limits, fresh auth, etc.).

### Replay from a stored envelope

When policy objects are not in memory, pass frozen results from capture:

```ts
toolMapToAiTools(tools, {
  env: ctx.env,
  policyResults: envelope.runtime!.policy.results,
  policySnapshotMode: "authoritative",
});
```

Snapshot policies deny at execute if their id is missing from `policyResults` when mode is `"authoritative"`.

Full guide: [AI SDK policies](../../docs/ai-sdk-policies.md).

## One-turn capture + AI SDK

Typical production flow:

1. `captureAgentSnapshotEnvelope` (core) → persist link + envelope.
2. Use `evaluatedTools` from the same capture for the model turn.
3. `toolMapToAiTools(evaluatedTools, { env, resolvedPolicies })` with the **same** `PolicyResultMap` from that evaluation pass.

See [persistence](../../docs/persistence.md) and [packages/capabilities/README.md](../capabilities/README.md).

## Development

```bash
bun run build
bun run test
bun run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
