# @khoralabs/agent-capabilities-spec

Smithy models for agent capabilities **interchange** and **persistence** (`agent.capabilities` namespace). This package ships **source models only** — no generated SDK artifacts are committed to the repo.

## What is in the tarball

| Path | Purpose |
|------|---------|
| `model/` | Smithy shapes and services |
| `smithy-build.json` | Smithy build config |
| `README.md`, `LICENSE` | Docs and license |

Consumers run Smithy tooling against `model/` in their own pipeline.

## Logical services (not RPC servers)

Smithy `service` blocks here define **contracts**, not HTTP/gRPC endpoints:

- **`AgentCapabilitiesPersistenceService`** — storage operations your backend implements (`UpsertRegisteredAgentSnapshot`, `RecordSessionCapabilityLink`, etc.). The TypeScript interface `AgentCapabilitiesPersistence` in `@khoralabs/agent-capabilities` mirrors this service.
- **Public / comparison shapes** — wire types for `CapabilityLink`, `AgentSnapshotEnvelope`, hash payloads, and diffs.

Hosts map operations to SQL, document stores, or internal APIs as they choose.

## Model overview

- **Shapes:** wire types, canonical hash payloads, `CapabilityLink`, diffs, `InvocationContextRecommended`.
- **Snapshots:** `AgentSnapshotEnvelope`, `AgentRuntimeSnapshot`, policy closure.
- **Persistence:** registered agents, session links, runtime snapshots, lineage transitions.

## Validate locally

Requires [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html):

```bash
cd packages/capabilities-spec
smithy validate model
# or: bun run validate
```

## TypeScript reference implementation

[`@khoralabs/agent-capabilities`](../capabilities) implements the persistence contract and hashing rules in-process. See repo docs:

- [persistence](../../docs/persistence.md)
- [hashing](../../docs/hashing.md)
- [schema versions](../../docs/schema-versions.md)
- [invocation context](../../docs/invocation-context.md)

## License

MIT — see [LICENSE](LICENSE).
