import type { CapabilityLink } from "./capability-link.js";

export type ToolRefRow = { toolKey: string; toolHash: string };

/** Symmetric diff of two runtime tool ref lists (order-independent, keyed by `toolKey`). */
export type ToolRefsDiff = {
  onlyInFirst: ToolRefRow[];
  onlyInSecond: ToolRefRow[];
  hashChanged: Array<{
    toolKey: string;
    firstHash: string;
    secondHash: string;
  }>;
};

export function diffToolRefs(first: ToolRefRow[], second: ToolRefRow[]): ToolRefsDiff {
  const m1 = new Map(first.map((r) => [r.toolKey, r.toolHash] as const));
  const m2 = new Map(second.map((r) => [r.toolKey, r.toolHash] as const));
  const onlyInFirst: ToolRefRow[] = [];
  const onlyInSecond: ToolRefRow[] = [];
  const hashChanged: ToolRefsDiff["hashChanged"] = [];

  for (const [k, h1] of m1) {
    const h2 = m2.get(k);
    if (h2 === undefined) {
      onlyInFirst.push({ toolKey: k, toolHash: h1 });
    } else if (h1 !== h2) {
      hashChanged.push({ toolKey: k, firstHash: h1, secondHash: h2 });
    }
  }
  for (const [k, h2] of m2) {
    if (!m1.has(k)) {
      onlyInSecond.push({ toolKey: k, toolHash: h2 });
    }
  }
  return { onlyInFirst, onlyInSecond, hashChanged };
}

/** Fields compared by {@link diffCapabilityLinks} (excludes `toolRefs`; use {@link diffToolRefs}). */
export type CapabilityLinkField = Exclude<keyof CapabilityLink, "toolRefs">;

export type CapabilityLinkFieldChange = {
  field: CapabilityLinkField;
  first: string | undefined;
  second: string | undefined;
};

/** Which {@link CapabilityLink} fields match vs differ. */
export type CapabilityLinksDiff = {
  unchanged: CapabilityLinkField[];
  changed: CapabilityLinkFieldChange[];
};

const CAPABILITY_LINK_FIELDS: CapabilityLinkField[] = [
  "agentId",
  "agentName",
  "staticHash",
  "runtimeHash",
  "invocationHash",
];

export function diffCapabilityLinks(a: CapabilityLink, b: CapabilityLink): CapabilityLinksDiff {
  const unchanged: CapabilityLinkField[] = [];
  const changed: CapabilityLinkFieldChange[] = [];
  for (const field of CAPABILITY_LINK_FIELDS) {
    const first = a[field] as string | undefined;
    const second = b[field] as string | undefined;
    if (first === second) {
      unchanged.push(field);
    } else {
      changed.push({ field, first, second });
    }
  }
  return { unchanged, changed };
}

/**
 * Short human-readable comparison for dashboards (not i18n).
 * Prefer {@link diffCapabilityLinks} for structured UI.
 */
export function explainCapabilityLinkRelationship(a: CapabilityLink, b: CapabilityLink): string {
  if (a.agentId !== b.agentId) {
    return "Different agent ids.";
  }
  const sameStatic = a.staticHash === b.staticHash;
  const sameRuntime = a.runtimeHash === b.runtimeHash;
  const sameInvocation = a.invocationHash === b.invocationHash;
  if (sameStatic && sameRuntime && sameInvocation && a.agentName === b.agentName) {
    return "Same capability link.";
  }
  if (!sameStatic) {
    return "Different static capabilities (toolkit / definition changed).";
  }
  if (!sameRuntime) {
    return "Same static capabilities; runtime differs (enabled tools or policies changed).";
  }
  if (!sameInvocation) {
    return "Same static and runtime; invocation context hash differs (subject, policy, or other binding changed).";
  }
  if (a.agentName !== b.agentName) {
    return "Same static, runtime, and invocation hashes; display name differs only.";
  }
  return "Differ in ways not covered above.";
}

/**
 * Abbreviated hash for tables (e.g. `abc123…fedcba`). Returns short strings unchanged.
 */
export function formatHashShort(
  hash: string,
  options?: { prefix?: number; suffix?: number },
): string {
  const prefix = options?.prefix ?? 6;
  const suffix = options?.suffix ?? 6;
  if (!hash.length) {
    return hash;
  }
  if (hash.length <= prefix + suffix + 1) {
    return hash;
  }
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}
