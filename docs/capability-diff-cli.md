# Capability diff CLI

Compare two persisted **CapabilityLink** or **AgentSnapshotEnvelope** JSON files and print a human-readable diff.

## Rich example

From `packages/capabilities`, generate sample envelopes and run three comparisons (runtime/policy, invocation, static drift):

```bash
bun run example:diff
```

Writes JSON under `examples/output/diff/` and prints human + `--json` reports. Re-run a single diff:

```bash
bun run capability-diff examples/output/diff/pro-tier.json examples/output/diff/free-tier.json \
  --label-a pro --label-b free
```

## Usage

From `packages/capabilities`:

```bash
bun run capability-diff path/to/first.json path/to/second.json
```

Options:

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable report (`summary`, `link`, `tools`, `policies`) |
| `--label-a name` | Label for the first file (default: path) |
| `--label-b name` | Label for the second file (default: path) |

## Input shapes

**CapabilityLink** — object with `agentId`, `staticHash`, `runtimeHash`; optional `toolRefs`, `invocationHash`.

**AgentSnapshotEnvelope** — object with `schemaVersion` `"1"` and `runtime.link` (see [schema versions](./schema-versions.md)). Policy and affordance sections appear when `runtime.policy` / `runtime.affordances` are present.

## Report sections

1. **Summary** — `explainCapabilityLinkRelationship` (static vs runtime vs invocation drift).
2. **Link fields** — per-field hash changes on the link (not `toolRefs`).
3. **Tools** — `diffToolRefs` on `link.toolRefs`.
4. **Policies** — when envelope policy snapshots and/or wire affordances exist on both sides.

## Programmatic API

```ts
import {
  parseDiffInput,
  extractDiffSources,
  formatCapabilityDiffReport,
  buildCapabilityDiffJsonReport,
} from "@khoralabs/agent-capabilities";
```

See [hashing](./hashing.md) for what each hash means.
