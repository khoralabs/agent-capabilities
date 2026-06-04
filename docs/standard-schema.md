# Standard Schema (BYO validator)

`@khoralabs/agent-capabilities` depends on **[Standard Schema](https://standardschema.dev)** for tool inputs, not on Zod, Valibot, or Arktype directly. Bring your own schema library as long as it exposes a Standard Schema V1 object on `tool({ inputSchema })`.

## Minimal surface

The package ships a small `StandardSchemaV1` type (see `packages/capabilities/src/standard-schema.ts`) with:

- `~standard.version` (must be `1`)
- `~standard.vendor` (library id string)
- `~standard.validate(value)` → `{ value }` or `{ issues }`

TypeScript inference uses `~standard.types` when present.

## Zod (example)

Use a Standard Schema adapter or Zod 4+ Standard Schema output:

```ts
import { tool } from "@khoralabs/agent-capabilities";
import { z } from "zod";

const inputSchema = z.object({ query: z.string() }); // must satisfy StandardSchemaV1

tool({
  name: "search",
  inputSchema,
  handler: async (_ctx, input) => input.query,
});
```

Check your Zod version's docs for `~standard` compatibility or an official bridge package.

## Valibot (example)

Use Valibot's Standard Schema export if available for your version:

```ts
import * as v from "valibot";
// inputSchema: Standard Schema object from valibot's standardSchema helper
```

## Stable static hashes

Static tool hashes include `schema: schemaToHashInput(inputSchema)`.

| Schema shape | Hashed value |
|--------------|--------------|
| `toJSONSchema()` present | Return value of `toJSONSchema()` (should be deterministic) |
| Otherwise | `{ vendor, version }` only |

**Recommendation:** Implement or use a schema whose `toJSONSchema()` output is stable across deploys (same definitions → same JSON Schema). If you rely on the vendor/version fallback, changing the library version changes hashes even when your fields are unchanged.

Changing hashed JSON Schema (required fields, types, descriptions if included in JSON Schema) changes `staticHash` and lineage. That is intentional for capability attribution.

## Validation at runtime

The core library hashes schemas; **your host** (or the AI SDK adapter) should validate tool arguments with the same schema before calling handlers. `@khoralabs/agent-capabilities-ai-sdk` maps schemas for model tool definitions; wire validation policy is up to the integrator.

## Custom schemas

You can implement `StandardSchemaV1` by hand for tests or internal tools:

```ts
const schema: StandardSchemaV1<{ n: number }> = {
  "~standard": {
    version: 1,
    vendor: "my-app",
    types: { input: {} as { n: number }, output: {} as { n: number } },
    validate: (v) =>
      typeof v === "object" && v !== null && "n" in v
        ? { value: v as { n: number } }
        : { issues: [{ message: "expected { n: number }" }] },
  },
  toJSONSchema() {
    return { type: "object", properties: { n: { type: "number" } }, required: ["n"] };
  },
};
```

For production, prefer maintained adapters from your schema library.
