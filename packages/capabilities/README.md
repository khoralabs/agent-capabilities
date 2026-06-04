# @khoralabs/agent-capabilities

**Composable toolkits + policies → deterministic SHA-256 fingerprints** for static tool definitions and for the effective tool set at evaluation time—so you can correlate behavior with a **versioned capability snapshot** (logs, evals, storage).

## What it does

- **Composable graph**: `tool`, `toolkit`, `dynamicToolkit`; evaluate with `ToolkitContext` (`env`, optional `namespace` / `agentId` / `agentName`, optional `pipelineHooks` / `inheritedPipelineHooks`).
- **Pipeline hooks** (not part of static hashes): `onPolicyEvaluated` / `onToolExecuted` via `mergeToolPipelineHooks`. Three levels — `hooks` on `toolkit` / `tool`, plus `ToolkitContext.pipelineHooks` (runtime). Typical merge order: ancestor toolkit → tool → runtime. Member tool policies are usually evaluated once at the parent toolkit (deduped); leaf `tool` hooks for policy run when that tool evaluates a policy not already in the shared `PolicyResultMap`.
- **Policies**: async gates that prune tools at runtime; policies dedupe by object identity.
- **Template capabilities (`staticHash` on a registered agent)**: hash of the **root composable** plus **agent-level instruction lines** from `createRegisteredAgent` — the agent *definition* you ship. `staticContext` is **not** part of this hash; keep default merged context out of the template fingerprint.
- **Capability runtime (`runtimeHash`)**: hash of **enabled tools only**, after policies (sorted by tool name). Differs from the template when policy or environment changes which tools are in play.
- **Invocation binding (optional `invocationHash` on an `CapabilityLink`)**: a separate SHA-256 over a **host-normalized** plain object (e.g. `subjectId`, `personaSlug`, policy bundle id) via `computeInvocationContextHash` / `createCapabilityLink` — the *run* or *tenant* slice without stuffing those fields into `staticInstructions` just to change hashes. Omit when you do not need binding-level lineage.
- **Zero runtime dependencies** (`dependencies` is empty). **[Standard Schema](https://standardschema.dev)** `inputSchema`; hashed canonically — see [standard-schema guide](../../docs/standard-schema.md) and [hashing appendix](../../docs/hashing.md).

This is **not** end-user authentication. `agentId` / `name` on `RegisteredAgent` are **your** labels for telemetry or storage.

## When to use it

- Tool lists change by **environment**, **feature flags**, or **deploys** — you need to know **which snapshot** ran (e.g. assistant gets different tools in staging vs prod).
- **Policies** gate tools — you need **runtime** capabilities, not only static.
- You want **stable ids** for dashboards, evals, or logs without ad hoc versioning.
- **Before/after** changing a tool’s schema or instructions — static hashes shift; use `diffToolRefs` / canonical payloads to compare.

**When not to:** you only need a single fixed tool list forever and never compare runs—skip this and use your framework’s tools directly.

**Out of scope:** your database adapter, threads, transports. This package defines the **persistence contract** (`AgentCapabilitiesPersistence`, Smithy service) and a `:memory:` reference implementation; you implement the same interface for your production store (SQL, document DB, object storage metadata, etc.).

## Quick example

Full pipeline (matches how many apps record one evaluation):

```ts
import {
  computeRuntimeCapabilitiesFromEvaluation,
  toolkit,
  tool,
} from "@khoralabs/agent-capabilities";

const search = tool({
  name: "search",
  inputSchema: yourStandardSchema,
  instructions: "…",
  handler: async () => {},
});

const root = toolkit([search], { name: "my-agent-tools" });

const { runtimeHash, toolRefs, evaluatedTools, nameToStaticHash } =
  await computeRuntimeCapabilitiesFromEvaluation(root, {
    env: { userTier: "pro" },
  });
// Build a CapabilityLink (optional invocation):
//   await createCapabilityLink({ agent, enabledToolNames: Object.keys(evaluatedTools),
//     nameToStaticHash, tools: evaluatedTools, invocationContext: { subjectId: "…" } });
// Or use computeFullCapabilityLink({ agent, ctx, invocationContext: { … } }).
```

Lower-level pieces: `collectToolStaticHashes(root)` → map of tool name → leaf hash; `evaluateComposable(root, ctx)` → tools; then `computeRuntimeHash(enabledNames, map, tools)` or `resolveRuntimeToolRefs(...)`.

More runnable scripts under `examples/` (see below). For Vercel AI SDK, use [`@khoralabs/agent-capabilities-ai-sdk`](../capabilities-ai-sdk).

## Declarative agents and sessions for implementors

**Single declaration.** Treat **`RegisteredAgent`** (from `createRegisteredAgent`) plus **`register(agent, { hooks, ctx, run })`** as one declaration of (1) *who* the agent is—root composable, static instructions, static context—and (2) *how* sessions are wired: optional **hooks**, **context** layers (`ctx`), and the **`run`** function. Registration is data-shaped; you are not reimplementing evaluation or the session machine.

**One orchestration implementation.** For a product, the only required **orchestration** at the session layer is a **`SessionRunner`**: implement **`run`** as `({ agent, input, context }) => output`. Everything else there is optional: **hooks** for cross-cutting behavior and **`ctx`** for merged static context and async resolvers. Session hooks wrap **one** invocation of `run`; they do not replace it.

**Two hook layers** — bind functions to the right layer so “hooks” does not mean “rewrite the tool loop”:

1. **Toolkit pipeline hooks** — `onPolicyEvaluated` / `onToolExecuted`, merged via `mergeToolPipelineHooks`, on **`toolkit` / `tool`** definitions and optionally **`ToolkitContext.pipelineHooks`**. These run **inside** composable evaluation while policies and tools execute. Use for telemetry or side effects around policy/tool execution, not for substituting your own evaluation loop.

2. **Session hooks** — `onStart`, `onBeforeContext`, `onAfterContext`, `onBeforeRun`, `onAfterRun`, `onError` on **`register`** / **`createSession`**, or chained on the returned **`AgentSession`**. These run **around** building `SessionContext` and calling **`run`**. Use for session lifecycle, logging, or injecting fields before your runner evaluates affordances (e.g. building a `ToolkitContext` inside `run` or `onBeforeRun`).

**Session API.** Call **`createSession(agentId)`** with the same string **`agentId`** you used at register time, then **`start(input)`**. Optional per-session overrides use the same `{ hooks, ctx, run }` shape.

**Session lifecycle (`start` order):** `onStart` → `onBeforeContext` (agent + input only) → merge `ctx` into `context` → `onAfterContext` → `onBeforeRun` → `run` → `onAfterRun` or `onError`. Use `onBeforeContext` for early setup; use `onAfterRun` for attribution (`recordTurnAttribution`) after capture inside `run`.

**Optional “one declarative blob” later.** A small factory or type that bundles **`RegisteredAgent`** with default **`RegisterAgentOptions`** is only sugar on top of **`register`**; it does not change semantics.

## API overview

Grouped by role; full exports (including types like `ToolSpec`, `Composable`, `CapabilityLink`) are in [`src/index.ts`](src/index.ts).

### Composables and evaluation

- `tool` / `toolkit` / `dynamicToolkit`
- `evaluateComposable(composable, ctx)`
- `policy(id, evaluate, { executeBinding?: "snapshot" | "live" })` — default `live`; use `snapshot` with shared `resolvedPolicies` at AI SDK execute
- `gateToolPoliciesAtExecute` — execute-boundary policy gate (used by ai-sdk adapter)
- `mergeToolPipelineHooks` / `evaluatePolicyWithHooks` — optional telemetry; hooks are **not** hashed

### Hashing and runtime snapshot

- `collectToolStaticHashes` / `computeRuntimeHash` / `resolveRuntimeToolRefs`
- `computeRuntimeCapabilitiesFromEvaluation` — one-shot evaluate + `nameToStaticHash` + runtime hash + `toolRefs` + `evaluatedTools`
- `hashToolSpecStatic` — dynamic-only / fallback tool static hash
- `hashPlainObject` / `schemaToHashInput`

### Invocation (binding lineage, optional)

- `normalizeInvocationContextForHash` / `invocationContextCanonicalPayload` / `computeInvocationContextHash`
- `computeFullCapabilityLink` — evaluate the agent’s root + `createCapabilityLink` in one call (optional `invocationContext`)

### Canonical payloads (debug / UI)

- `runtimeCapabilityCanonicalPayload` / `toolSpecCanonicalPayload` (invocation: `invocationContextCanonicalPayload`)

### Agent label + link

- `createRegisteredAgent` / `createCapabilityLink` (optional `invocationContext` / `invocationContextAllowlist`)

### Dashboard-style helpers

- `formatHashShort` / `diffToolRefs` / `diffCapabilityLinks` / `explainCapabilityLinkRelationship`

### Persistence (Smithy contract + `:memory:`)

- `AgentCapabilitiesPersistence` — implement for your DB; see [persistence guide](../../docs/persistence.md)
- `createMemoryAgentCapabilitiesPersistence()` — `:memory:` backend (like SQLite `:memory:`)
- `recordTurnAttribution(persistence, { op, sessionId, link, envelope? })` — write link + optional envelope after capture
- `registeredAgentToRegistrationRow` / `capabilityLinkToRow` / `envelopeToRow` / `defaultOpContext`

### Session host (`createAgentRegistry`)

- `createAgentRegistry({ persistence? })` — defaults to `:memory:` persistence; session host + orchestration overlay
- `createToolRegistry` / `hashToolComposableStatic`
- `await createAgentRegistry().register(agent, { hooks, ctx, run })` — see [Declarative agents and sessions for implementors](#declarative-agents-and-sessions-for-implementors)
- `createAgentRegistry().createSession(agentId, { hooks, ctx, run, sessionId? })` — `agentId` matches `RegisteredAgent.agentId`
  - `session.onStart(...)` / `session.onBeforeContext(...)` / `session.onAfterContext(...)` / `session.onBeforeRun(...)` / `session.onAfterRun(...)` / `session.onError(...)`
  - `session.start(input)` runs with composed hooks and merged context (`session > registry > agent static`), then **`run`**

### Optional host / UX helpers

Not required for hashing or persistence — see [host helpers guide](../../docs/host-helpers.md).

- `elapsedMs` — timing from `performance.now()`
- `createToolRegistry` — in-memory composable catalog (tests/examples)
- `withFormattedResults` — `{ ok, data? } | { ok: false, error }` wrapper

### Capture one turn (persistence + same-turn LLM)

- `AGENT_SNAPSHOT_ENVELOPE_VERSION` — current `AgentSnapshotEnvelope.schemaVersion` (`"1"`); see [schema versions](../../docs/schema-versions.md)
- `captureAgentRuntimeSnapshot` — one evaluation pass → `AgentRuntimeSnapshot` + live `evaluatedTools` / `instructions` / `link` / `toolRefs`
- `captureAgentSnapshotEnvelope` — same pass → full `AgentSnapshotEnvelope` (optional `sessionContext`, `includeStatic`)
- `registeredAgentToWire` / `toolkitContextToWire` — wire helpers used by capture

## Capture one turn for persistence

For each message or job, call **`captureAgentSnapshotEnvelope`** (or **`captureAgentRuntimeSnapshot`** if you only need the runtime slice):

```ts
const { envelope, link, evaluatedTools, instructions } = await captureAgentSnapshotEnvelope({
  agent,
  ctx: { env: { userTier: "pro" }, agentId: agent.agentId, agentName: agent.name },
  invocationContext: { subjectId: "user-1" }, // optional third fingerprint
  sessionContext: { messageId: "msg-abc" },   // envelope.context (not hashed)
  policyMode: "authoritative",
});
// Persist envelope (JSON) or Smithy CapabilityLinkRow fields from link + toolRefs
// Use evaluatedTools + instructions for the LLM on this same turn
```

| Field | Role |
|-------|------|
| `invocationContext` | Hashed into `link.invocationHash` (tenant/subject/persona binding); see [invocation context](../../docs/invocation-context.md) |
| `sessionContext` | Stored in `envelope.context` only; not part of capability hashes |
| `runtime.toolkitContext` | JSON-safe `env` / `agentId` / `namespace` from `ToolkitContext` (hooks omitted) |
| `runtime.affordances` | Wire tools for storage/replay via `hydrateAffordances` |
| `evaluatedTools` | Live handlers for this turn (not persisted) |

Use **`captureAgentRuntimeSnapshot`** when the static template is unchanged and you only append runtime rows. Use **`computeFullCapabilityLink`** when you only need hashes without a full wire snapshot.

## Mapping to persistence

Hashes and wire payloads are computed in-process; durable storage uses [`AgentCapabilitiesPersistence`](../../docs/persistence.md) (Smithy `AgentCapabilitiesPersistenceService`). Host backends assign opaque ids (`registrationId`, `linkId`, etc.); row builders accept optional ids.

**What to store:** prefer `recordTurnAttribution` or a full **`AgentSnapshotEnvelope`** from `captureAgentSnapshotEnvelope`, or a **`CapabilityLink`** (includes `toolRefs`) plus wire affordances. `AgentRuntimeSnapshot` still exposes top-level `toolRefs` for envelope v1; they should match `link.toolRefs`. If you need forensics, persist the **same** `invocationContext` object you passed to capture (or store it in host `metadata`).

## Invocation context

Recommended keys and the split between hashed `invocationContext` and non-hashed `sessionContext` are documented in [docs/invocation-context.md](../../docs/invocation-context.md). Export: `InvocationContextRecommended`.

## Examples

```bash
bun run example:static
bun run example:dynamic
bun run example:capabilities
```

`01-static-toolkit.ts` / `02-dynamic-toolkit.ts` — evaluate composables and map tools via `@khoralabs/agent-capabilities-ai-sdk`.

## Tests

```bash
bun test
```
