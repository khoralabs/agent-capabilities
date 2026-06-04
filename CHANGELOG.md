# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Added

- `@khoralabs/agent-capabilities`: composable toolkits, policy gates, three-layer capability fingerprints (`staticHash`, `runtimeHash`, optional `invocationHash`), `CapabilityLink`, snapshot wire types, and one-turn capture (`captureAgentSnapshotEnvelope`, `captureAgentRuntimeSnapshot`).
- `@khoralabs/agent-capabilities-spec`: Smithy models under `agent.capabilities` for interchange and persistence contracts.
- `@khoralabs/agent-capabilities-ai-sdk`: Vercel AI SDK adapter for evaluated `ToolSpec` values.

### Changed

- Rebranded from agent-identity to agent-capabilities across APIs and packages.
- Removed built-in `pino` logging; telemetry via pipeline and session hooks.
