# @khoralabs/agent-capabilities

Composable toolkits, policy gates, and deterministic capability fingerprints for agents.

Licensed under [MIT](LICENSE). See [CHANGELOG.md](CHANGELOG.md) for releases.

## Packages

| Package | Description |
|---------|-------------|
| [`@khoralabs/agent-capabilities`](packages/capabilities) | Core library |
| [`@khoralabs/agent-capabilities-spec`](packages/capabilities-spec) | Smithy wire models |
| [`@khoralabs/agent-capabilities-ai-sdk`](packages/capabilities-ai-sdk) | Vercel AI SDK adapter |

## Development

```bash
bun install   # runs husky via prepare
bun run format
bun run format:check
bun run test
bun run typecheck
bun run build
```

**Git hooks (Husky):** `pre-commit` runs `format:check`; `pre-push` runs `format:check`, `typecheck`, and `test`. Install the [Biome VS Code extension](.vscode/extensions.json) for format-on-save.

Publishable packages emit `dist/` via `tsc` (Node 18+). See [`packages/capabilities/README.md`](packages/capabilities/README.md) for API docs.

**Docs:** [invocation context](docs/invocation-context.md), [envelope schema versions](docs/schema-versions.md).
