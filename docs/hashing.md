# Capability hashing (normative)

Capability fingerprints are **SHA-256** hex strings over **canonical JSON** produced by `hashPlainObject` in `@khoralabs/agent-capabilities`. Implementations that reproduce hashes in another language or service must match this algorithm.

## Canonical JSON (`hashPlainObject`)

1. **Recursive key sort** — At every object, keys are ordered with `localeCompare` (UTF-16 code unit order, same as JavaScript's default string sort).
2. **`undefined` omitted** — Own properties whose value is `undefined` are dropped before serialization (not serialized as `null`).
3. **Arrays** — Element order is preserved; elements are canonicalized recursively.
4. **Primitives** — `null`, booleans, numbers, and strings pass through unchanged (no special number normalization).
5. **Digest** — UTF-8 encode the JSON string from step 1–4, then SHA-256, then lowercase hex (64 characters).

`JSON.stringify` is applied to the sorted tree; do not add extra whitespace.

Exported helpers `runtimeCapabilityCanonicalPayload`, `toolSpecCanonicalPayload`, and `invocationContextCanonicalPayload` build the **pre-hash** objects documented below. Prefer them for diffs and UIs rather than re-deriving field names.

## Schema field (`schemaToHashInput`)

Tool and wire payloads use `schemaToHashInput(inputSchema)`:

- If the schema object has `toJSONSchema()`, that return value is hashed.
- Otherwise `{ vendor, version }` from the schema's `~standard` props.

See [standard-schema.md](./standard-schema.md).

## Tool static hash (`kind: "tool"`)

Produced by `tool()` → `computeStaticHash()` (and `hashToolSpecStatic` / `toolSpecCanonicalPayload` for evaluated specs; wire replay uses the same fields when policies/bindings match).

| Field | Rule |
|-------|------|
| `kind` | `"tool"` |
| `name` | Tool name string |
| `description` | `string` or `null` |
| `schema` | Output of `schemaToHashInput` |
| `instructions` | Array of instruction **lines** (caller supplies `string[]`); sorted with `localeCompare` |
| `policies` | Policy **ids** only, sorted by `localeCompare` |
| `policyBindings` | Present only when `policies.length > 0`: `{ id, executeBinding }[]` sorted by `id`; `executeBinding` defaults to `"live"` when omitted on the policy |

**Runtime evaluation text:** When tools run, instruction blocks from toolkits are joined with `\n\n` for the model. That join affects **runtime instructions**, not the static hash array above.

## Toolkit static hash (`kind: "toolkit"`)

| Field | Rule |
|-------|------|
| `kind` | `"toolkit"` |
| `name` | Toolkit name |
| `instructions` | Toolkit-level `instructions` option or `null` (not split on `\n\n` at hash time) |
| `members` | `{ name, hash }[]` where `hash` is each member's `computeStaticHash()`; sorted by member `name` |

## Dynamic toolkit static hash (`kind: "dynamicToolkit"`)

| Field | Rule |
|-------|------|
| `kind` | `"dynamicToolkit"` |
| `name` | Name |
| `instructions` | `string[]` or `null` |
| `policies` | Sorted policy **ids** (same id sort as tools) |

## Registered agent template (`staticHash`)

Not a single `kind` field. Payload:

```json
{
  "rootComposableHash": "<toolkit/tool static hash>",
  "agentInstructions": ["line1", "line2"]
}
```

- `agentInstructions`: trimmed non-empty lines from `createRegisteredAgent`, in caller order (not re-sorted).
- `staticContext` on the agent is **not** hashed into `staticHash`.

## Runtime capability hash (`runtimeHash`)

Payload from `runtimeCapabilityCanonicalPayload`:

```json
{
  "kind": "runtime",
  "tools": [{ "name": "<toolKey>", "hash": "<static tool hash>" }]
}
```

- Only **enabled** tools after policy evaluation.
- `tools` sorted by `name` (`localeCompare`).
- Each `hash` is that tool's static hash from the evaluation's name→hash map.

## Invocation binding (`invocationHash`, optional)

Wrapper payload:

```json
{
  "kind": "invocation",
  "context": { }
}
```

`context` is built by `normalizeInvocationContextForHash`: plain objects only, no `undefined` values, nested keys sorted, `Date` → ISO string; rejects functions, `BigInt`, symbols, and cycles. Optional allowlist restricts top-level keys. See [invocation-context.md](./invocation-context.md).

## Policy evaluation order (runtime, not hashed)

Policies are **deduped by object identity** in a shared `Map` during a composable evaluation pass. Ids are sorted only inside **static** hash payloads. Evaluation order follows composable traversal (toolkit → members → tools), not id sort.

## Capability link

`createCapabilityLink` combines `staticHash`, `runtimeHash`, optional `invocationHash`, and `toolRefs`. Use `diffToolRefs` / `diffCapabilityLinks` for comparisons.

## Verification

Package tests in `packages/capabilities/src/hashing/hash.test.ts`, `canonical-payloads.test.ts`, and `invocation-context.test.ts` assert stability and payload/hash alignment.
