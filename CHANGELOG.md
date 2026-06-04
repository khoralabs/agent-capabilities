# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Added

- `@khoralabs/agent-capabilities`: composable toolkits, policy gates, three-layer capability fingerprints (`staticHash`, `runtimeHash`, optional `invocationHash`), `CapabilityLink`, snapshot wire types, and one-turn capture (`captureAgentSnapshotEnvelope`, `captureAgentRuntimeSnapshot`).
- `@khoralabs/agent-capabilities-spec`: Smithy models under `agent.capabilities` for interchange and persistence contracts.
- `@khoralabs/agent-capabilities-ai-sdk`: Vercel AI SDK adapter for evaluated `ToolSpec` values.
- `CapabilityLink.toolRefs` populated by `createCapabilityLink` for single-row persistence.
- `InvocationContextRecommended` type (TS + Smithy) and [invocation context conventions](docs/invocation-context.md).
- [Envelope schema versioning policy](docs/schema-versions.md) and `AGENT_SNAPSHOT_ENVELOPE_VERSION` (`"1"`).
- `AgentCapabilitiesPersistence` interface, `createMemoryAgentCapabilitiesPersistence` (`:memory:`), `recordTurnAttribution`, and Smithy `GetLatestRegisteredAgentForAgent`.
- `createAgentRegistry({ persistence })` composes session host with default in-memory persistence; `register` is async and upserts registration rows.

### Schema versioning

- Initial envelope `schemaVersion` is `"1"` (see [docs/schema-versions.md](docs/schema-versions.md)).
- **Patch** releases may add optional fields without bumping `schemaVersion`.
- **Minor** releases bump `AGENT_SNAPSHOT_ENVELOPE_VERSION` when envelope or nested wire shapes change incompatibly.

### Changed

- Rebranded from agent-identity to agent-capabilities across APIs and packages.
- Removed built-in `pino` logging; telemetry via pipeline and session hooks.
