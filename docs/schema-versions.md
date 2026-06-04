# Agent snapshot envelope schema versions

`AgentSnapshotEnvelope.schemaVersion` is a string version for persistence and migration. The reference constant is `AGENT_SNAPSHOT_ENVELOPE_VERSION` in `@khoralabs/agent-capabilities` (exported from `capture-turn.ts`).

## Version table

| schemaVersion | Package release | Notes |
|---------------|-----------------|-------|
| `"1"` | 0.1.0 | Initial envelope: optional `static`, `policy`, `runtime` (`AgentRuntimeSnapshot`), optional `context`. `CapabilityLink` includes `toolRefs`; `runtime.toolRefs` duplicates `link.toolRefs` for backward compatibility. |

## Consumer rules

1. Read `schemaVersion` before parsing nested shapes.
2. Reject or branch on unknown versions—do not assume the latest shape.
3. For envelope v1, when `link.toolRefs` is present, `runtime.toolRefs` should match; use `diffToolRefs` for per-tool drift, not `diffCapabilityLinks`.

## When to bump `AGENT_SNAPSHOT_ENVELOPE_VERSION`

| Change | Semver (package) | schemaVersion |
|--------|------------------|---------------|
| Add optional fields only (envelope, link, wire types) | Patch (e.g. 0.1.x) | Unchanged |
| Rename/remove required fields, change hash semantics, remove duplicate fields | Minor (e.g. 0.2.0) | Increment (e.g. `"2"`) |

Document each new version in this file and in [CHANGELOG.md](../CHANGELOG.md).

## Migration policy (maintainers)

- **Patch:** optional additive wire fields; same `schemaVersion`.
- **Minor:** increment `AGENT_SNAPSHOT_ENVELOPE_VERSION`, describe migration in CHANGELOG and this doc.
- **Consumers:** never auto-upgrade stored envelopes; migrate explicitly per version.
