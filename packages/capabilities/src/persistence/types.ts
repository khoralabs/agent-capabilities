import type { AgentSnapshotEnvelope } from "../snapshot/types.js";

/** Host operation context (Smithy `CapabilitiesOpContext`). */
export type CapabilitiesOpContext = {
  now: number;
  tenantId?: string;
  actorId?: string;
};

export type RegisteredAgentRegistrationRow = {
  registrationId: string;
  agentId: string;
  staticHash: string;
  staticProps: Record<string, unknown>;
  _ts_created: number;
};

export type CapabilityLinkRow = {
  linkId: string;
  sessionId: string;
  _ts_created: number;
  agentId: string;
  agentName: string;
  staticHash: string;
  runtimeHash: string;
  invocationHash?: string;
  toolRefs?: Array<{ toolKey: string; toolHash: string }>;
  metadata?: Record<string, unknown>;
};

export type RuntimeSnapshotRow = {
  snapshotId: string;
  sessionId: string;
  _ts_created: number;
  runtimeHash: string;
  toolRefs: Array<{ toolKey: string; toolHash: string }>;
  metadata?: Record<string, unknown>;
};

export type AffordanceSnapshotEnvelopeRow = {
  snapshotId: string;
  sessionId: string;
  _ts_created: number;
  schemaVersion: string;
  envelope: AgentSnapshotEnvelope;
  metadata?: Record<string, unknown>;
};

export type CapabilityTransitionRow = {
  transitionId: string;
  sessionId: string;
  fromLinkId: string;
  toLinkId: string;
  _ts_created: number;
  metadata?: Record<string, unknown>;
};

export type UpsertRegisteredAgentSnapshotInput = {
  op: CapabilitiesOpContext;
  row: RegisteredAgentRegistrationRow;
};

export type UpsertRegisteredAgentSnapshotOutput = {
  registrationId: string;
};

export type GetLatestRegisteredAgentForAgentInput = {
  agentId: string;
};

export type GetLatestRegisteredAgentForAgentOutput = {
  row?: RegisteredAgentRegistrationRow;
};

export type RecordSessionCapabilityLinkInput = {
  op: CapabilitiesOpContext;
  link: CapabilityLinkRow;
};

export type RecordSessionCapabilityLinkOutput = {
  linkId: string;
};

export type GetLatestCapabilityLinkForSessionInput = {
  sessionId: string;
};

export type GetLatestCapabilityLinkForSessionOutput = {
  link?: CapabilityLinkRow;
};

export type ListCapabilityLinksForAgentInput = {
  agentId: string;
  query?: Record<string, unknown>;
};

export type ListCapabilityLinksForAgentOutput = {
  links: CapabilityLinkRow[];
  nextPage?: Record<string, unknown>;
};

export type RecordRuntimeToolRefSnapshotInput = {
  op: CapabilitiesOpContext;
  row: RuntimeSnapshotRow;
};

export type RecordRuntimeToolRefSnapshotOutput = {
  snapshotId: string;
};

export type RecordAffordanceSnapshotEnvelopeInput = {
  op: CapabilitiesOpContext;
  row: AffordanceSnapshotEnvelopeRow;
};

export type RecordAffordanceSnapshotEnvelopeOutput = {
  snapshotId: string;
};

export type GetAffordanceSnapshotEnvelopeInput = {
  snapshotId: string;
};

export type GetAffordanceSnapshotEnvelopeOutput = {
  row?: AffordanceSnapshotEnvelopeRow;
};

export type RecordCapabilityTransitionInput = {
  op: CapabilitiesOpContext;
  row: CapabilityTransitionRow;
};

export type RecordCapabilityTransitionOutput = {
  transitionId: string;
};
