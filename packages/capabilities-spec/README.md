# @khoralabs/agent-capabilities-spec

Smithy models for agent capabilities interchange and persistence (`agent.capabilities` namespace).

- **Shapes:** wire types, canonical hash payloads, `CapabilityLink`, diffs.
- **Snapshots:** `AgentSnapshotEnvelope`, `AgentRuntimeSnapshot`, policy closure.
- **Persistence / public services:** storage and comparison contracts (logical operations; implement in your backend).

Validate locally:

```bash
smithy validate model
```

The TypeScript reference implementation lives in `@khoralabs/agent-capabilities`.
