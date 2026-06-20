# @khoralabs/agent-capabilities-otel

**Beta (0.1.x)** — OpenTelemetry and Pino adapter for `@khoralabs/agent-capabilities`. Published on npm with the `beta` dist-tag until the adapter API stabilizes alongside core `0.2.x`.

Maps session and pipeline hooks to OTel spans/metrics and structured Pino logs without pulling observability dependencies into the core package.

## Install

```bash
npm install @khoralabs/agent-capabilities @khoralabs/agent-capabilities-otel @opentelemetry/api pino
# or: bun add ...
```

Peer dependencies: `@khoralabs/agent-capabilities` `^0.1.0`, `@opentelemetry/api` `^1`, `pino` `^9`, TypeScript `^5`.

Bring your own configured `Tracer`, optional `Meter`, and `Logger` instances — this package does not start an OTel SDK or configure exporters.

## When to use

- You run agents via `createAgentRegistry` / `createSession` and want turn-level spans plus tool/policy telemetry.
- You already use pipeline hooks (`onToolExecuted`, `onPolicyEvaluated`) or session hooks for attribution and want OTel/Pino without reimplementing hook wiring.
- You need capability hashes (`staticHash`, `runtimeHash`, `invocationHash`) on session spans for correlation with persisted `CapabilityLink` rows.

See also: [Attribution and telemetry](../../docs/attribution-telemetry.md).

## Quick start

One `createAgentTelemetry()` instance per session — use the same instance for session hooks, pipeline hooks, and `linkCapabilityLink`:

```ts
import {
  captureAgentSnapshotEnvelope,
  createAgentRegistry,
  createRegisteredAgent,
} from "@khoralabs/agent-capabilities";
import { createAgentTelemetry } from "@khoralabs/agent-capabilities-otel";
import { trace } from "@opentelemetry/api";
import pino from "pino";

const tracer = trace.getTracer("my-app");
const logger = pino();

const tel = createAgentTelemetry({ tracer, logger });

const session = registry.createSession(agent.agentId, {
  hooks: tel.sessionHooks,
  run: async ({ agent, context }) => {
    const ctx = {
      env: context,
      agentId: agent.agentId,
      pipelineHooks: tel.pipelineHooks,
    };
    const capture = await tel.traceAffordanceEvaluation(() =>
      captureAgentSnapshotEnvelope({
        agent,
        ctx,
        invocationContext: {
          traceId: context.traceId as string,
          tenantId: context.tenantId as string,
        },
        sessionContext: { messageId: context.messageId as string },
      }),
    );
    tel.linkCapture({
      link: capture.link,
      toolRefs: capture.toolRefs,
      invocationContext: {
        traceId: context.traceId as string,
        tenantId: context.tenantId as string,
      },
      sessionContext: capture.envelope.context,
    });
    return { instructions: capture.instructions, tools: capture.evaluatedTools };
  },
});

await session.start({ message: "hello" });
```

## Coexisting with custom hooks

Telemetry hooks are **additive**. The registry runs every hook registered at each lifecycle stage — nothing is replaced.

### Session hooks (middleware, side effects)

At each stage the registry runs, in order:

1. Hooks from `register({ hooks })`
2. Hooks from `createSession({ hooks })`
3. Fluent hooks (`.onAfterRun(...)`, etc.)

Layer telemetry with your own session hooks:

```ts
const tel = createAgentTelemetry({ tracer, logger });

registry.register(agent, {
  hooks: {
    onBeforeRun: async ({ context }) => {
      // auth, tenancy, feature flags
    },
    onAfterRun: async ({ output }) => {
      // webhooks, cache invalidation
    },
  },
});

registry.createSession(agent.agentId, {
  hooks: {
    ...tel.sessionHooks,
    onAfterRun: async (args) => {
      await tel.sessionHooks.onAfterRun?.(args);
      // run after telemetry records the session span
    },
  },
  run,
});
```

Or keep concerns split: global middleware on `register`, telemetry on `createSession`.

### Pipeline hooks (audit, custom metrics)

Use `mergeToolPipelineHooks` from the core package to compose telemetry with your own pipeline listeners:

```ts
import { mergeToolPipelineHooks } from "@khoralabs/agent-capabilities";

const ctx = {
  env: context,
  pipelineHooks: mergeToolPipelineHooks(tel.pipelineHooks, auditHooks, rateLimitHooks),
};
```

All handlers receive the same event payload and run in registration order (first layer first).

### Span correlation

Use **one** `createAgentTelemetry()` per session so `linkCapture(link)` enriches the same session span that `sessionHooks.onStart` opened. Create a new instance for each `createSession` call.

## Domain-specific signals

Attach tenant, subject, tool refs, and custom business fields without manual span wiring.

### Declarative attribute mappers

Configure mappers once at construction; they run automatically at the right lifecycle point:

```ts
import {
  capabilityLinkAttributes,
  createAgentTelemetry,
  invocationContextAttributes,
  sessionContextAttributes,
} from "@khoralabs/agent-capabilities-otel";

const tel = createAgentTelemetry({
  tracer,
  logger,
  attributeMappers: {
    sessionContext: sessionContextAttributes({
      allowlist: ["tenantId", "subjectId", "traceId"],
      prefix: "session.",
    }),
    invocationContext: invocationContextAttributes({ prefix: "invocation." }),
    capabilityLink: capabilityLinkAttributes({ hashPrefixLength: 12 }),
  },
  toolPayloads: { includeInput: "hash-only" },
  policyTracing: { spanOnPass: "execute-only" },
  spanHooks: {
    onSessionSpanStart(span) {
      span.setAttribute("deployment.environment", process.env.NODE_ENV ?? "unknown");
    },
  },
});
```

| Mapper | When it runs |
|--------|--------------|
| `sessionContext` | `onAfterContext` (merged `SessionContext` ready) |
| `invocationContext` | `linkCapture` (pass raw slice from call site) |
| `capabilityLink` | `linkCapture` |
| `toolExecuted` | Each tool span |
| `policyEvaluated` | Each policy span (pass or deny) |

Mapper throws are logged at `warn` and do not fail the agent turn.

### Imperative helpers (inside `run`)

| Method | Role |
|--------|------|
| `linkCapture(args)` | Hashes + tool ref span events + invocation/capability mappers |
| `setSessionAttributes(attrs)` | Attach attrs to the active session span |
| `addSessionEvent(name, attrs?)` | OTel span event for high-cardinality domain signals |
| `traceAffordanceEvaluation(fn)` | Wrap evaluation in `agent.affordance.evaluate` span |

### Attribute naming convention

| Prefix | Source | Examples |
|--------|--------|----------|
| `agent.*` | Built-in + capability link | `agent.id`, `agent.runtime_hash`, `agent.tool_count` |
| `session.*` | Merged `SessionContext` | `session.tenantId`, `session.messageId` |
| `invocation.*` | `invocationContext` slice | `invocation.subjectId`, `invocation.traceId` |
| `tool.*` | Tool execution | `tool.name`, `tool.input_hash`, `tool.output_hash` |
| `policy.*` | Policy evaluation | `policy.id`, `policy.phase` |

Span events (not attributes) for high-cardinality data:

- `agent.tool.ref` — per enabled tool ref from `linkCapture`
- `agent.domain.*` — ad-hoc business signals via `addSessionEvent`

### Tool payload tracing (opt-in)

When `toolPayloads` is set:

- `includeInput` / `includeOutput`: `true` (raw JSON, dev) or `"hash-only"` (SHA-256 fingerprint, prod-safe)
- `redact(value, path)` — run before serialize/hash
- `maxStringLength` — truncate serialized JSON (default 1024)

### Policy pass spans (opt-in)

| `policyTracing.spanOnPass` | Behavior |
|----------------------------|----------|
| `false` (default) | Pass → debug Pino only |
| `"execute-only"` | Pass span when `phase === "execute"` |
| `true` | Pass span for all phases |

## API

| Export | Role |
|--------|------|
| `createAgentTelemetry(options?)` | Returns hooks + imperative helpers |
| `toSpanAttributes`, `invocationContextAttributes`, `sessionContextAttributes`, `capabilityLinkAttributes` | Preset attribute mappers |
| `linkCapabilityLink(link)` | Attach hash attrs only (minimal) |
| `linkCapture(args)` | Full capture linking with events and mappers |
| `setSessionAttributes` / `addSessionEvent` | Imperative session span enrichment |
| `traceAffordanceEvaluation(fn)` | Evaluation span wrapper |

## Span hierarchy

```
agent.session                    (onStart → onAfterRun / onError)
├── agent.affordance.evaluate    (traceAffordanceEvaluation)
├── agent.tool.execute           (onToolExecuted; timing from durationMs)
├── agent.policy.passed          (onPolicyEvaluated when ok=true, opt-in)
└── agent.policy.denied          (onPolicyEvaluated when ok=false)
```

Policy passes are debug-logged by default (no span). Use `policyTracing.spanOnPass` to enable pass spans. Prefer `linkCapture` over `linkCapabilityLink` when you need tool ref events and domain mappers.

## OTel metrics (optional `meter`)

| Instrument | Type | Attributes |
|------------|------|------------|
| `agent.tool.executions` | Counter | `tool.name`, `tool.ok` |
| `agent.tool.duration_ms` | Histogram | `tool.name` |
| `agent.session.runs` | Counter | `agent.id`, `ok` |

## Pino log events

| Event | Level | Fields |
|-------|-------|--------|
| `agent.session.start` | `info` | `agentId`, `agentName`, `staticHash` |
| `agent.session.end` | `info` | `agentId`, `durationMs` |
| `agent.session.error` | `error` | `agentId`, `durationMs`, `err` |
| `agent.tool.executed` | `info` | `toolName`, `durationMs` |
| `agent.tool.error` | `error` | `toolName`, `durationMs`, `error` |
| `agent.policy.passed` | `debug` | `policyId`, `phase`, `toolName`, `composableName` |
| `agent.policy.denied` | `warn` | `policyId`, `phase`, `toolName`, `error` |
| `agent.capability_link` | `debug` | `runtimeHash`, `invocationHash`, `toolCount`, `agentId` |

## Development

```bash
bun run build
bun run test
bun run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
