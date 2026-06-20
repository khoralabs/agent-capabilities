import type {
  CapabilityLink,
  RegisteredAgent,
  SessionContext,
} from "@khoralabs/agent-capabilities";
import type { SpanAttributes, SpanAttributeValue } from "./types.js";

export type ToSpanAttributesOptions = {
  allowlist?: string[];
  prefix?: string;
};

const INVOCATION_RECOMMENDED_KEYS = [
  "traceId",
  "sessionId",
  "messageId",
  "tenantId",
  "actorId",
  "subjectId",
  "personaSlug",
  "policyBundleId",
] as const;

function isSpanAttributeValue(value: unknown): value is SpanAttributeValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function toSpanAttributes(obj: unknown, opts: ToSpanAttributesOptions = {}): SpanAttributes {
  if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj)) {
    return {};
  }
  const record = obj as Record<string, unknown>;
  const keys = (opts.allowlist ?? Object.keys(record)).slice().sort();
  const prefix = opts.prefix ?? "";
  const out: SpanAttributes = {};
  for (const key of keys) {
    const value = record[key];
    if (isSpanAttributeValue(value)) {
      out[`${prefix}${key}`] = value;
    }
  }
  return out;
}

export function invocationContextAttributes(opts: ToSpanAttributesOptions = {}) {
  return (ctx: unknown): SpanAttributes =>
    toSpanAttributes(ctx, {
      allowlist: opts.allowlist ?? [...INVOCATION_RECOMMENDED_KEYS],
      prefix: opts.prefix ?? "invocation.",
    });
}

export function sessionContextAttributes(opts: ToSpanAttributesOptions = {}) {
  return (args: {
    agent: RegisteredAgent;
    input: unknown;
    context: SessionContext;
  }): SpanAttributes =>
    toSpanAttributes(args.context, {
      allowlist: opts.allowlist,
      prefix: opts.prefix ?? "session.",
    });
}

export type CapabilityLinkAttributesOptions = {
  includeToolNames?: boolean;
  hashPrefixLength?: number;
};

export function capabilityLinkAttributes(opts: CapabilityLinkAttributesOptions = {}) {
  return (link: CapabilityLink): SpanAttributes => {
    const out: SpanAttributes = {};
    if (opts.includeToolNames !== false) {
      out["agent.enabled_tools"] = link.toolRefs.map((r) => r.toolKey).join(",");
    }
    const prefixLen = opts.hashPrefixLength;
    if (prefixLen !== undefined && prefixLen > 0) {
      out["agent.runtime_hash_short"] = link.runtimeHash.slice(0, prefixLen);
      if (link.invocationHash !== undefined) {
        out["agent.invocation_hash_short"] = link.invocationHash.slice(0, prefixLen);
      }
    }
    return out;
  };
}
