# Attribution and telemetry

One-page guide for hosts: which hooks to use, what to persist per turn, and how the three “context” concepts differ.

**See also:** [persistence](persistence.md), [invocation context](invocation-context.md), [host helpers](host-helpers.md), [AI SDK policies](ai-sdk-policies.md), [envelope schema versions](schema-versions.md).

## Two hook layers

| Layer | API | When it runs | Use for |
|-------|-----|--------------|---------|
| **Pipeline** | `onPolicyEvaluated` / `onToolExecuted` on `tool` / `toolkit`, merged via `mergeToolPipelineHooks` or `ToolkitContext.pipelineHooks` | Inside composable evaluation (policy checks, tool handlers) | Per-policy spans, tool latency, execute-boundary telemetry |
| **Session** | `onStart` … `onAfterRun` / `onError` on `register` / `createSession` | Around merged `SessionContext` and one `run` invocation | Turn lifecycle, capture + `recordTurnAttribution`, error handling |

**Decision rule:** pipeline hooks observe *what happened inside evaluation*; session hooks observe *one host turn* (build context → run → persist).

Pipeline hooks are **not hashed**. Session hooks are host orchestration only.

### Session lifecycle (`start` order)

`onStart` → `onBeforeContext` → merge `ctx` → `onAfterContext` → `onBeforeRun` → **`run`** → `onAfterRun` or `onError`.

- Capture inside **`run`** (you have evaluated tools and a `ToolkitContext`).
- Persist in **`onAfterRun`** via `recordTurnAttribution` (after `run` returns).
- On runner failure, **`onError`** runs and **`onAfterRun` does not**.

### Session cancellation

Pass an `AbortSignal` to `createSession({ signal })` (or override per run via `session.start(input, { signal })`). When the signal aborts:

- Stages and `run` stop with **`AgentSessionAbortedError`** (check via `isAgentSessionAbortedError`).
- The resolved **`SessionContext`** includes **`abortSignal`** when a signal is configured — forward it to `ToolkitContext` / `ToolRuntimeContext` and AI SDK calls (`streamText`, `generate`, etc.).
- **`onError`** runs ( **`onAfterRun` does not** ). With `@khoralabs/agent-capabilities-otel`, cancellation logs `agent.session.cancelled` and sets span attribute `agent.session.cancelled = true` (OK status, not ERROR).

```ts
import {
  AgentSessionAbortedError,
  createAgentRegistry,
  isAgentSessionAbortedError,
} from "@khoralabs/agent-capabilities";

const controller = new AbortController();
const session = registry.createSession(agentId, { signal: controller.signal });

try {
  await session.start(input);
} catch (err) {
  if (isAgentSessionAbortedError(err)) {
    // user cancelled — distinct from runner failure
  }
  throw err;
}
```

## Three context concepts

Do not confuse these names:

| Name | Where | Hashed? | Stored as |
|------|-------|---------|-----------|
| **`invocationContext`** | `createCapabilityLink` / `captureAgentSnapshotEnvelope` | Yes → `link.invocationHash` | Lineage binding (tenant, subject, persona) |
| **`sessionContext`** | `captureAgentSnapshotEnvelope({ sessionContext })` | No | `envelope.context` only |
| **`SessionContext`** (type) | Merged from `register` / `createSession` `ctx` layers | No | Runtime session state passed into `run` |

Put keys in **invocation** when they should affect lineage hashes. Put keys in **session** (`sessionContext`) when you need correlation in storage without changing hashes (e.g. `messageId`). Use merged **`SessionContext`** for values your `run` handler needs (user id, feature flags, DB handles).

Details: [invocation context](invocation-context.md).

## Per-turn recipe

```ts
import {
  captureAgentSnapshotEnvelope,
  createAgentRegistry,
  createRegisteredAgent,
  defaultOpContext,
  recordTurnAttribution,
} from "@khoralabs/agent-capabilities";

const registry = createAgentRegistry({ persistence: yourPersistence });
const { agent } = await createRegisteredAgent({ /* … */ });

let lastCapture: Awaited<ReturnType<typeof captureAgentSnapshotEnvelope>> | undefined;

await registry.register(agent, {
  run: async ({ agent, context }) => {
    lastCapture = await captureAgentSnapshotEnvelope({
      agent,
      ctx: { env: {}, agentId: agent.agentId },
      invocationContext: {
        traceId: context.traceId as string,
        subjectId: context.subjectId as string,
      },
      sessionContext: { messageId: context.messageId as string },
    });
    return { instructions: lastCapture.instructions };
  },
});

const session = registry.createSession(agent.agentId, {
  sessionId: "sess-abc",
  ctx: { traceId: "tr-1", subjectId: "user-1", messageId: "msg-1" },
  hooks: {
    onAfterRun: async () => {
      if (!lastCapture) return;
      await recordTurnAttribution(yourPersistence, {
        op: defaultOpContext(),
        sessionId: "sess-abc",
        link: lastCapture.link,
        envelope: lastCapture.envelope,
      });
    },
  },
});

await session.start({});
```

Runnable example: `packages/capabilities/examples/05-session-attribution.ts` (`bun run example:session-attribution`).

## What to persist

| Artifact | When | Notes |
|----------|------|-------|
| **`CapabilityLink`** | Every attributed turn | `staticHash`, `runtimeHash`, optional `invocationHash`, `toolRefs` |
| **`AgentSnapshotEnvelope`** | When you need full replay / forensics | Includes wire affordances, policy snapshot, `envelope.context` |
| **Raw `invocationContext`** | When hashes are not enough for audit | Pass as `linkMetadata` on `recordTurnAttribution` (not hashed; stored on `CapabilityLinkRow.metadata`) |
| **Extra envelope fields** | Host-specific forensics | `envelopeMetadata` on `recordTurnAttribution` |

Prefer `recordTurnAttribution(persistence, { op, sessionId, link, envelope? })` over ad-hoc row writes.

`createAgentRegistry()` with default `:memory:` persistence is for **tests and prototypes**; production implements `AgentCapabilitiesPersistence` against your DB. See [persistence](persistence.md).

## Pipeline hook payloads

### `PolicyEvaluatedPayload`

| Field | Type | Notes |
|-------|------|-------|
| `ok` | `boolean` | Policy allowed |
| `policyId` | `string` | Policy id |
| `phase` | `"toolkit"` \| `"tool"` \| `"dynamicToolkit"` \| `"execute"` | Where evaluation ran |
| `toolName` | `string?` | When `phase` is `"tool"` |
| `composableName` | `string?` | Parent toolkit name |
| `error` | `string?` | When `ok` is false |
| `env` | `unknown` | Toolkit environment |

At the AI SDK execute boundary, `phase` is `"execute"`. See [AI SDK policies](ai-sdk-policies.md).

### `ToolExecutedPayload`

| Field | Type | Notes |
|-------|------|-------|
| `ok` | `boolean` | Tool succeeded |
| `toolName` | `string` | Tool name |
| `input` | `unknown` | Tool input |
| `output` | `unknown?` | Tool output when `ok` |
| `error` | `string?` | When `ok` is false |
| `durationMs` | `number?` | Host may set via `elapsedMs` helper |
| `env` | `unknown` | Toolkit environment |

```ts
import { elapsedMs, mergeToolPipelineHooks } from "@khoralabs/agent-capabilities";

const hooks = mergeToolPipelineHooks(existing, {
  onToolExecuted: async ({ toolName, ok, env }) => {
    // emit span / metric
  },
});
```

## OpenTelemetry and Pino (`@khoralabs/agent-capabilities-otel`)

For production-ready spans, metrics, and structured logs without wiring hooks yourself, use the OTel adapter package:

```ts
import { mergeToolPipelineHooks } from "@khoralabs/agent-capabilities";
import {
  createAgentTelemetry,
  invocationContextAttributes,
  sessionContextAttributes,
} from "@khoralabs/agent-capabilities-otel";

const tel = createAgentTelemetry({
  tracer,
  meter,
  logger,
  attributeMappers: {
    sessionContext: sessionContextAttributes({
      allowlist: ["tenantId", "subjectId"],
      prefix: "session.",
    }),
    invocationContext: invocationContextAttributes(),
  },
});

registry.createSession(agentId, {
  hooks: tel.sessionHooks,
  run: async ({ agent, context }) => {
    const ctx = {
      env: context,
      pipelineHooks: mergeToolPipelineHooks(tel.pipelineHooks, yourAuditHooks),
    };
    const capture = await tel.traceAffordanceEvaluation(() =>
      captureAgentSnapshotEnvelope({
        agent,
        ctx,
        invocationContext: { tenantId: context.tenantId as string },
      }),
    );
    tel.linkCapture({
      link: capture.link,
      toolRefs: capture.toolRefs,
      invocationContext: { tenantId: context.tenantId as string },
    });
    // ...
  },
});
```

**Coexisting with custom hooks:** session and pipeline hooks are additive — the registry runs every registered handler at each stage in order (`register` → `createSession` → fluent `.onAfterRun`). Telemetry does not replace your middleware. Use one `createAgentTelemetry()` instance per session. Compose pipeline hooks with `mergeToolPipelineHooks(tel.pipelineHooks, yours)`.

**Domain signals:** use `attributeMappers` for tenant/subject/trace fields, `linkCapture` for tool refs + hashes, `setSessionAttributes` / `addSessionEvent` for ad-hoc business events. Attribute prefix convention: `agent.*`, `session.*`, `invocation.*`, `tool.*`, `policy.*`.

Full guide: [packages/capabilities-otel/README.md](../packages/capabilities-otel/README.md).

## Capture knobs

| Option | Default | Purpose |
|--------|---------|---------|
| `policyMode` | `"hint"` | `"authoritative"` if serialized policy results are ground truth for replay |
| `policyAudit` | — | Optional `capturedAt`, `policyBundleId`, `policyEngineVersion` on policy snapshot |
| `invocationContextAllowlist` | all keys | Hash only a subset of `invocationContext` keys |
| `includeStatic` | `true` | Include registered-agent static block in envelope |

Envelope version: `AGENT_SNAPSHOT_ENVELOPE_VERSION` (`"1"`). Migration policy: [schema versions](schema-versions.md).

## Correlation conventions

| Key | Typical layer | Notes |
|-----|---------------|-------|
| `traceId` | `invocationContext` | Distributed trace / lineage |
| `tenantId`, `actorId`, `subjectId`, `personaSlug` | `invocationContext` | Multi-tenant binding |
| `policyBundleId` | `invocationContext` or `policyAudit` | Policy set at capture |
| `sessionId` | `createSession({ sessionId })` + persistence args | Durable session row key |
| `messageId` | `sessionContext` | Per-message correlation without changing hashes |

OpenTelemetry span names, metrics, and Pino event names: [capabilities-otel README](../packages/capabilities-otel/README.md).
