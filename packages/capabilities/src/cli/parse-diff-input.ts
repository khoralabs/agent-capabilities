import type { CapabilityLink } from "../agent/capability-link.js";
import { AGENT_SNAPSHOT_ENVELOPE_VERSION } from "../snapshot/capture-turn.js";
import type {
  AgentSnapshotEnvelope,
  PolicyEvaluationSnapshot,
  RegisteredAgentAffordancesWire,
} from "../snapshot/types.js";

export type DiffInputKind =
  | { kind: "link"; link: CapabilityLink }
  | { kind: "envelope"; envelope: AgentSnapshotEnvelope };

export type DiffSources = {
  link: CapabilityLink;
  policy?: PolicyEvaluationSnapshot;
  affordances?: RegisteredAgentAffordancesWire;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeLink(raw: Record<string, unknown>): CapabilityLink {
  if (
    typeof raw.agentId !== "string" ||
    typeof raw.staticHash !== "string" ||
    typeof raw.runtimeHash !== "string"
  ) {
    throw new Error(
      "Expected a CapabilityLink (agentId, staticHash, runtimeHash) or AgentSnapshotEnvelope (schemaVersion).",
    );
  }
  const toolRefs = Array.isArray(raw.toolRefs)
    ? raw.toolRefs.map((r) => {
        if (!isRecord(r) || typeof r.toolKey !== "string" || typeof r.toolHash !== "string") {
          throw new Error("Invalid toolRefs entry: expected { toolKey, toolHash }.");
        }
        return { toolKey: r.toolKey, toolHash: r.toolHash };
      })
    : [];
  const link: CapabilityLink = {
    agentId: raw.agentId,
    agentName: typeof raw.agentName === "string" ? raw.agentName : "",
    staticHash: raw.staticHash,
    runtimeHash: raw.runtimeHash,
    toolRefs,
  };
  if (typeof raw.invocationHash === "string") {
    link.invocationHash = raw.invocationHash;
  }
  return link;
}

export function parseDiffInput(json: unknown): DiffInputKind {
  if (!isRecord(json)) {
    throw new Error("Expected a JSON object (CapabilityLink or AgentSnapshotEnvelope).");
  }
  if (typeof json.schemaVersion === "string") {
    if (json.schemaVersion !== AGENT_SNAPSHOT_ENVELOPE_VERSION) {
      throw new Error(
        `Unsupported schemaVersion "${json.schemaVersion}" (expected "${AGENT_SNAPSHOT_ENVELOPE_VERSION}").`,
      );
    }
    return { kind: "envelope", envelope: json as AgentSnapshotEnvelope };
  }
  if (
    typeof json.agentId === "string" &&
    typeof json.staticHash === "string" &&
    typeof json.runtimeHash === "string"
  ) {
    return { kind: "link", link: normalizeLink(json) };
  }
  throw new Error(
    "Expected a CapabilityLink (agentId, staticHash, runtimeHash) or AgentSnapshotEnvelope (schemaVersion).",
  );
}

export function extractDiffSources(input: DiffInputKind): DiffSources {
  if (input.kind === "link") {
    return { link: input.link };
  }
  const envelope = input.envelope;
  const runtime = envelope.runtime;
  if (!runtime?.link) {
    throw new Error("AgentSnapshotEnvelope requires runtime.link for comparison.");
  }
  const policy = runtime.policy ?? envelope.policy;
  const affordances = runtime.affordances;
  const out: DiffSources = { link: runtime.link };
  if (policy) {
    out.policy = policy;
  }
  if (affordances) {
    out.affordances = affordances;
  }
  return out;
}
