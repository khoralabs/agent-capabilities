import type { ToolSpec } from "../tool/types.js";
import { schemaToHashInput } from "./hash.js";

/** Exact JSON-shaped input to {@link hashPlainObject} for a runtime tool snapshot (before SHA-256). */
export type RuntimeCapabilityCanonicalPayload = {
  kind: "runtime";
  tools: Array<{ name: string; hash: string }>;
};

/**
 * Canonical object hashed for runtime capabilities (same structure as {@link computeRuntimeHash}).
 * Safe to serialize for dashboards and diffs; contains no {@link ToolSpec} handlers.
 */
export function runtimeCapabilityCanonicalPayload(
  toolRefs: Array<{ toolKey: string; toolHash: string }>,
): RuntimeCapabilityCanonicalPayload {
  return {
    kind: "runtime",
    tools: toolRefs.map((r) => ({ name: r.toolKey, hash: r.toolHash })),
  };
}

/** Exact JSON-shaped input to {@link hashPlainObject} for a single tool’s static definition. */
export type ToolCapabilityCanonicalPayload = {
  kind: "tool";
  name: string;
  description: string | null;
  schema: unknown;
  instructions: string[];
  policies: string[];
};

/**
 * Canonical object hashed by {@link hashToolSpecStatic} (before SHA-256).
 * Pairs with {@link runtimeCapabilityCanonicalPayload} for “what differed?” UIs.
 */
export function toolSpecCanonicalPayload(spec: ToolSpec): ToolCapabilityCanonicalPayload {
  const instructionLines = spec.instructions ? spec.instructions.split("\n\n") : [];
  return {
    kind: "tool",
    name: spec.name,
    description: spec.description ?? null,
    schema: schemaToHashInput(spec.inputSchema),
    instructions: [...instructionLines].sort((a, b) => a.localeCompare(b)),
    policies: spec.policyIds ?? [],
  };
}
