# @khoralabs/agent-capabilities-zod

Bridges evaluated `@khoralabs/agent-capabilities` tool specs to Vercel AI SDK `tool()` helpers (`toolSpecToAiTool`, `toolMapToAiTools`). Keeps `@khoralabs/agent-capabilities` free of a direct `ai` dependency for core types; consumers that run ToolLoopAgent import from this package.
