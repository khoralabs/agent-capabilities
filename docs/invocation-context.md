# Invocation context conventions

`invocationContext` is an optional plain object passed to `createCapabilityLink`, `computeFullCapabilityLink`, or capture helpers. It is normalized and hashed into `CapabilityLink.invocationHash` via `normalizeInvocationContextForHash` / `computeInvocationContextHash`. It is **not** part of `staticHash` or `runtimeHash`.

The TypeScript type `InvocationContextRecommended` and Smithy `InvocationContextRecommended` document **recommended optional keys**. They are conventions only—nothing is validated at runtime, and hosts may add arbitrary plain keys.

## Invocation vs session context

| Layer | API | Hashed into capability fingerprints? | Typical use |
|-------|-----|--------------------------------------|-------------|
| Invocation | `invocationContext` on link/capture | Yes → `invocationHash` | Tenant, subject, persona, policy bundle binding |
| Session | `sessionContext` on `captureAgentSnapshotEnvelope` | No → `envelope.context` only | Message id, UI correlation, forensics |

Put keys in **invocation** when they should change lineage hashes (e.g. different `subjectId` → different `invocationHash`). Put keys in **session** when you only need correlation in storage without affecting hashes.

## Recommended keys

| Key | Typical layer | Notes |
|-----|---------------|-------|
| `traceId` | Invocation | Distributed trace correlation in lineage |
| `tenantId` | Invocation | Multi-tenant binding |
| `actorId` | Invocation | Acting principal (not end-user auth) |
| `subjectId` | Invocation | User or resource the run is about |
| `personaSlug` | Invocation | Persona / role variant |
| `policyBundleId` | Invocation | Policy set version at capture time |
| `sessionId` | Session (`envelope.context`) | Prefer here unless you want it in `invocationHash` |
| `messageId` | Session (`envelope.context`) | Prefer here unless you want it in `invocationHash` |

You may pass `sessionId` or `messageId` in `invocationContext` if you intentionally want them in `invocationHash` (e.g. strict per-message lineage). Use `invocationContextAllowlist` to hash only a subset of keys.

## Allowlist example

```ts
await createCapabilityLink({
  agent,
  enabledToolNames,
  nameToStaticHash,
  tools: evaluatedTools,
  invocationContext: {
    subjectId: "user-1",
    messageId: "msg-abc", // present but not hashed
    traceId: "tr-1",
  },
  invocationContextAllowlist: ["subjectId", "traceId"],
});
```

## Normalization rules

- Root must be a **plain object** (not array, function, or class instance).
- Nested values must be JSON-serializable: strings, numbers, booleans, null, plain objects, arrays.
- `Date` → ISO string; `undefined` keys omitted; keys sorted at every object level for determinism.
- Functions, `BigInt`, symbols, and circular references throw.

See `normalizeInvocationContextForHash` in `@khoralabs/agent-capabilities`.

## Forensics

Hashes alone cannot recover the original context. Persist the same object you passed to capture (or store it in host `metadata` on `CapabilityLinkRow`) when you need audit replay.
