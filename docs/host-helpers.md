# Optional host and UX helpers

These exports are **not required** for capability hashing, capture, or persistence. Use them when they fit your app shell, examples, or tests.

## `elapsedMs(start)`

High-resolution elapsed milliseconds from a `performance.now()` mark.

```ts
import { elapsedMs } from "@khoralabs/agent-capabilities";

const start = performance.now();
await doWork();
const ms = elapsedMs(start);
```

Useful in `onToolExecuted` / custom telemetry. Not included in any capability hash.

## `createToolRegistry()`

In-memory map of composables keyed by a caller string (convention: tool name), with secondary lookup by static hash.

```ts
const reg = createToolRegistry();
await reg.register("search", searchComposable);
reg.get("search");
reg.getByHash(staticHash);
```

Helpful for **examples**, **unit tests**, or small local catalogs. Production apps usually register tools inside agent graphs (`toolkit` / `createRegisteredAgent`) and persist via `AgentCapabilitiesPersistence`, not a standalone registry.

## `withFormattedResults(promise)`

Wraps a `Promise` into a discriminated `{ ok: true, data? } | { ok: false, error: string }` result (errors become message strings).

```ts
const output = await withFormattedResults(handlerThatMightThrow());
```

Convenience for hosts that want uniform tool JSON without try/catch in every handler. AI SDK and core `tool()` handlers do not require this shape.

## Related (attribution / ops, still optional)

- `formatHashShort`, `diffToolRefs`, `diffCapabilityLinks` — dashboards and support tooling
- `recordTurnAttribution` — persistence helper after capture

See [packages/capabilities/README.md](../packages/capabilities/README.md) for the full export list.
