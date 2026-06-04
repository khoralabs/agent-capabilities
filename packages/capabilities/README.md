# @khoralabs/agent-capabilities

**Composable toolkits + policies → deterministic SHA-256 fingerprints** for static tool definitions and for the effective tool set at evaluation time—so you can correlate behavior with a **versioned capability snapshot** (logs, evals, storage).

## What it does

- **Composable graph**: `tool`, `toolkit`, `dynamicToolkit`; evaluate with `ToolkitContext` (`env`, optional `namespace` / `agentId` / `agentName`, optional `pipelineHooks` / `inheritedPipelineHooks`).
- **Pipeline hooks** (not part of static hashes): `onPolicyEvaluated` / `onToolExecuted` via `mergeToolPipelineHooks`. Three levels — `hooks` on `toolkit` / `tool`, plus `ToolkitContext.pipelineHooks` (runtime). Typical merge order: ancestor toolkit → tool → runtime. Member tool policies are usually evaluated once at the parent toolkit (deduped); leaf `tool` hooks for policy run when that tool evaluates a policy not already in the shared `PolicyResultMap`.
- **Policies**: async gates that prune tools at runtime; policies dedupe by object identity.
- **Template capabilities (`staticHash` on a registered agent)**: hash of the **root composable** plus **agent-level instruction lines** from `createRegisteredAgent` — the agent *definition* you ship. `staticContext` is **not** part of this hash; keep default merged context out of the template fingerprint.
- **Capability runtime (`runtimeHash`)**: hash of **enabled tools only**, after policies (sorted by tool name). Differs from the template when policy or environment changes which tools are in play.
- **Invocation binding (optional `invocationHash` on an `CapabilityLink`)**: a separate SHA-256 over a **host-normalized** plain object (e.g. `subjectId`, `personaSlug`, policy bundle id) via `computeInvocationContextHash` / `createCapabilityLink` — the *run* or *tenant* slice without stuffing those fields into `staticInstructions` just to change hashes. Omit when you do not need binding-level lineage.
- **Zero runtime dependencies** (`dependencies` is empty). **[Standard Schema](https://standardschema.dev)** `inputSchema`; hashed canonically (e.g. `toJSONSchema()` when present).

This is **not** end-user authentication. `agentId` / `name` on `RegisteredAgent` are **your** labels for telemetry or storage.

## When to use it

- Tool lists change by **environment**, **feature flags**, or **deploys** — you need to know **which snapshot** ran (e.g. assistant gets different tools in staging vs prod).
- **Policies** gate tools — you need **runtime** capabilities, not only static.
- You want **stable ids** for dashboards, evals, or logs without ad hoc versioning.
- **Before/after** changing a tool’s schema or instructions — static hashes shift; use `diffToolRefs` / canonical payloads to compare.

**When not to:** you only need a single fixed tool list forever and never compare runs—skip this and use your framework’s tools directly.

**Out of scope:** persistence, threads, transports. You supply correlation ids (message id, job id, etc.). Optional: store hashes in **Convex** or any DB per message/job; this package does not require Convex.

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

More runnable scripts under `examples/` (see below). `examples/toAiSdk.ts` maps evaluated `ToolSpec` values to Vercel AI SDK `tool()`.

## Declarative agents and sessions for implementors

**Single declaration.** Treat **`RegisteredAgent`** (from `createRegisteredAgent`) plus **`register(agent, { hooks, ctx, run })`** as one declaration of (1) *who* the agent is—root composable, static instructions, static context—and (2) *how* sessions are wired: optional **hooks**, **context** layers (`ctx`), and the **`run`** function. Registration is data-shaped; you are not reimplementing evaluation or the session machine.

**One orchestration implementation.** For a product, the only required **orchestration** at the session layer is a **`SessionRunner`**: implement **`run`** as `({ agent, input, context }) => output`. Everything else there is optional: **hooks** for cross-cutting behavior and **`ctx`** for merged static context and async resolvers. Session hooks wrap **one** invocation of `run`; they do not replace it.

**Two hook layers** — bind functions to the right layer so “hooks” does not mean “rewrite the tool loop”:

1. **Toolkit pipeline hooks** — `onPolicyEvaluated` / `onToolExecuted`, merged via `mergeToolPipelineHooks`, on **`toolkit` / `tool`** definitions and optionally **`ToolkitContext.pipelineHooks`**. These run **inside** composable evaluation while policies and tools execute. Use for telemetry or side effects around policy/tool execution, not for substituting your own evaluation loop.

2. **Session hooks** — `onStart`, `onAfterAgent`, `onAfterContext`, `onBeforeRun`, `onAfterRun`, `onError` on **`register`** / **`createSession`**, or chained on the returned **`AgentSession`**. These run **around** building `SessionContext` and calling **`run`**. Use for session lifecycle, logging, or injecting fields before your runner evaluates affordances (e.g. building a `ToolkitContext` inside `run` or `onBeforeRun`).

**Session API.** Call **`createSession(agentId)`** with the same string **`agentId`** you used at register time, then **`start(input)`**. Optional per-session overrides use the same `{ hooks, ctx, run }` shape.

**Optional “one declarative blob” later.** A small factory or type that bundles **`RegisteredAgent`** with default **`RegisterAgentOptions`** is only sugar on top of **`register`**; it does not change semantics.

## API overview

Grouped by role; full exports (including types like `ToolSpec`, `Composable`, `CapabilityLink`) are in [`src/index.ts`](src/index.ts).

### Composables and evaluation

- `tool` / `toolkit` / `dynamicToolkit`
- `evaluateComposable(composable, ctx)`
- `policy(id, evaluate)`
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

### Registries (in-memory; tests / examples)

- `createToolRegistry` / `createAgentRegistry` / `hashToolComposableStatic`
- `createAgentRegistry().register(agent, { hooks, ctx, run })` — see [Declarative agents and sessions for implementors](#declarative-agents-and-sessions-for-implementors)
- `createAgentRegistry().createSession(agentId, { hooks, ctx, run })` — `agentId` matches `RegisteredAgent.agentId`
  - `session.onStart(...)` / `session.onAfterAgent(...)` / `session.onAfterContext(...)` / `session.onBeforeRun(...)` / `session.onAfterRun(...)` / `session.onError(...)`
  - `session.start(input)` runs with composed hooks and merged context (`session > registry > agent static`), then **`run`**

### Output

- `withFormattedResults`

## Mapping to persistence

This package only computes hashes and payloads. A database may add its own ids (`registrationId`, `toolVersionId`, etc.). Host backends may define their own persistence schemas; those ids are **not** emitted here.

**What to store:** for correlation, you typically persist `staticHash`, `runtimeHash`, and optionally `invocationHash` from `CapabilityLink` together with a JSON-safe snapshot of **tool affordances** and, if you need forensics, the **same** `invocationContext` object you hashed (or a host-defined `metadata` document); see `AgentSnapshotEnvelope` in the snapshot types. The Smithy `capabilities-spec` model describes optional rows (`CapabilityLinkRow`, transitions) for backends — not implemented in this package.

## Examples

```bash
bun run example:static
bun run example:dynamic
bun run example:capabilities
```

`examples/toAiSdk.ts` — map `ToolSpec` → AI SDK `tool()`.

## Tests

```bash
bun test
```
