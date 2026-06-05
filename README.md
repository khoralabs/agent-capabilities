# @khoralabs/agent-capabilities

Composable toolkits, policy gates, and deterministic capability fingerprints for agents.

Licensed under [MIT](LICENSE). See [CHANGELOG.md](CHANGELOG.md) for releases.

## Packages

| Package | Description |
|---------|-------------|
| [`@khoralabs/agent-capabilities`](packages/capabilities) | Core library (stable `0.1.x`) |
| [`@khoralabs/agent-capabilities-spec`](packages/capabilities-spec) | Smithy wire models (source-only npm tarball) |
| [`@khoralabs/agent-capabilities-ai-sdk`](packages/capabilities-ai-sdk) | Vercel AI SDK adapter (**npm `beta` tag** for `0.1.x`) |

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

**Docs:** [attribution and telemetry](docs/attribution-telemetry.md), [hashing](docs/hashing.md), [Standard Schema](docs/standard-schema.md), [persistence](docs/persistence.md), [host helpers](docs/host-helpers.md), [capability diff CLI](docs/capability-diff-cli.md), [AI SDK policies](docs/ai-sdk-policies.md), [invocation context](docs/invocation-context.md), [envelope schema versions](docs/schema-versions.md).

**Community:** [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Publishing

Each package has a manual **release** workflow. Set **version**, run with **dry run** first, then publish for real. Releases stage under `release/<name>/` outside workspaces; the **verify npm publish access** step dry-runs before the real publish.

| Workflow | Package | Default npm tag |
|----------|---------|-----------------|
| `release @khoralabs/agent-capabilities` | Core library | `latest` |
| `release @khoralabs/agent-capabilities-spec` | Smithy models | `latest` |
| `release @khoralabs/agent-capabilities-ai-sdk` | AI SDK adapter | `beta` |

Requires the `NPM_TOKEN` repository secret.
