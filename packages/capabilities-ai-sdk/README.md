# @khoralabs/agent-capabilities-ai-sdk

Bridges evaluated `@khoralabs/agent-capabilities` tool specs to Vercel AI SDK `tool()` helpers (`toolSpecToAiTool`, `toolMapToAiTools`). Keeps the core package free of a direct `ai` dependency; use this package when running ToolLoopAgent or similar.

```ts
import { toolMapToAiTools } from "@khoralabs/agent-capabilities-ai-sdk";
```

Policies on each `ToolSpec` are re-evaluated on every AI SDK `execute` call. Prefer tools already gated by composable evaluation, or document env parity with your `ToolkitContext`.
