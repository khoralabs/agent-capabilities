# @khoralabs/agent-capabilities-ai-sdk

Bridges evaluated `@khoralabs/agent-capabilities` tool specs to Vercel AI SDK `tool()` helpers (`toolSpecToAiTool`, `toolMapToAiTools`). Keeps the core package free of a direct `ai` dependency; use this package when running ToolLoopAgent or similar.

```ts
import { toolMapToAiTools } from "@khoralabs/agent-capabilities-ai-sdk";
```

Policies use per-policy **`executeBinding`** (`snapshot` | `live`, default `live`). Pass the same `resolvedPolicies` map from `evaluateComposable` into `ToolRuntimeContext` so snapshot policies skip re-evaluation on each AI SDK `execute`. Live policies always re-run at execute.

```ts
const resolved = new Map();
const { tools } = await evaluateComposable(root, ctx, { resolvedPolicies: resolved });
const aiTools = toolMapToAiTools(tools, { env: ctx.env, resolvedPolicies: resolved });
```

See [AI SDK policies](../../docs/ai-sdk-policies.md) for bindings, authoritative replay, and hooks.
