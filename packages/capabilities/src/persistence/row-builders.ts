import type { CapabilityLink } from "../agent/capability-link.js";
import type { RegisteredAgent } from "../agent/types.js";
import type { AgentSnapshotEnvelope } from "../snapshot/types.js";
import { newLinkId, newRegistrationId, newSnapshotId } from "./ids.js";
import type {
  AffordanceSnapshotEnvelopeRow,
  CapabilitiesOpContext,
  CapabilityLinkRow,
  RegisteredAgentRegistrationRow,
} from "./types.js";

export function defaultOpContext(
  overrides?: Partial<CapabilitiesOpContext>,
): CapabilitiesOpContext {
  return {
    now: Date.now(),
    ...overrides,
  };
}

export function registeredAgentToRegistrationRow(
  agent: RegisteredAgent,
  op: CapabilitiesOpContext,
  registrationId?: string,
): RegisteredAgentRegistrationRow {
  return {
    registrationId: registrationId ?? newRegistrationId(),
    agentId: agent.agentId,
    staticHash: agent.staticHash,
    staticProps: { ...agent.staticProps } as Record<string, unknown>,
    _ts_created: op.now,
  };
}

export function capabilityLinkToRow(
  link: CapabilityLink,
  sessionId: string,
  op: CapabilitiesOpContext,
  options?: { linkId?: string; metadata?: Record<string, unknown> },
): CapabilityLinkRow {
  const row: CapabilityLinkRow = {
    linkId: options?.linkId ?? newLinkId(),
    sessionId,
    _ts_created: op.now,
    agentId: link.agentId,
    agentName: link.agentName,
    staticHash: link.staticHash,
    runtimeHash: link.runtimeHash,
    toolRefs: [...link.toolRefs],
  };
  if (link.invocationHash !== undefined) {
    row.invocationHash = link.invocationHash;
  }
  if (options?.metadata !== undefined) {
    row.metadata = { ...options.metadata };
  }
  return row;
}

export function envelopeToRow(
  envelope: AgentSnapshotEnvelope,
  sessionId: string,
  op: CapabilitiesOpContext,
  options?: { snapshotId?: string; metadata?: Record<string, unknown> },
): AffordanceSnapshotEnvelopeRow {
  const row: AffordanceSnapshotEnvelopeRow = {
    snapshotId: options?.snapshotId ?? newSnapshotId(),
    sessionId,
    _ts_created: op.now,
    schemaVersion: envelope.schemaVersion,
    envelope,
  };
  if (options?.metadata !== undefined) {
    row.metadata = { ...options.metadata };
  }
  return row;
}
