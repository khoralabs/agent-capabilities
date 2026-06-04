import type {
  GetAffordanceSnapshotEnvelopeInput,
  GetAffordanceSnapshotEnvelopeOutput,
  GetLatestCapabilityLinkForSessionInput,
  GetLatestCapabilityLinkForSessionOutput,
  GetLatestRegisteredAgentForAgentInput,
  GetLatestRegisteredAgentForAgentOutput,
  ListCapabilityLinksForAgentInput,
  ListCapabilityLinksForAgentOutput,
  RecordAffordanceSnapshotEnvelopeInput,
  RecordAffordanceSnapshotEnvelopeOutput,
  RecordCapabilityTransitionInput,
  RecordCapabilityTransitionOutput,
  RecordRuntimeToolRefSnapshotInput,
  RecordRuntimeToolRefSnapshotOutput,
  RecordSessionCapabilityLinkInput,
  RecordSessionCapabilityLinkOutput,
  UpsertRegisteredAgentSnapshotInput,
  UpsertRegisteredAgentSnapshotOutput,
} from "./types.js";

/**
 * TypeScript reference implementation of Smithy `AgentCapabilitiesPersistenceService`.
 * Production hosts implement the same surface against their database; use
 * {@link createMemoryAgentCapabilitiesPersistence} for `:memory:` (dev/tests).
 */
export type AgentCapabilitiesPersistence = {
  upsertRegisteredAgentSnapshot(
    input: UpsertRegisteredAgentSnapshotInput,
  ): Promise<UpsertRegisteredAgentSnapshotOutput>;

  getLatestRegisteredAgentForAgent(
    input: GetLatestRegisteredAgentForAgentInput,
  ): Promise<GetLatestRegisteredAgentForAgentOutput>;

  recordSessionCapabilityLink(
    input: RecordSessionCapabilityLinkInput,
  ): Promise<RecordSessionCapabilityLinkOutput>;

  getLatestCapabilityLinkForSession(
    input: GetLatestCapabilityLinkForSessionInput,
  ): Promise<GetLatestCapabilityLinkForSessionOutput>;

  listCapabilityLinksForAgent(
    input: ListCapabilityLinksForAgentInput,
  ): Promise<ListCapabilityLinksForAgentOutput>;

  recordRuntimeToolRefSnapshot(
    input: RecordRuntimeToolRefSnapshotInput,
  ): Promise<RecordRuntimeToolRefSnapshotOutput>;

  recordAffordanceSnapshotEnvelope(
    input: RecordAffordanceSnapshotEnvelopeInput,
  ): Promise<RecordAffordanceSnapshotEnvelopeOutput>;

  getAffordanceSnapshotEnvelope(
    input: GetAffordanceSnapshotEnvelopeInput,
  ): Promise<GetAffordanceSnapshotEnvelopeOutput>;

  recordCapabilityTransition(
    input: RecordCapabilityTransitionInput,
  ): Promise<RecordCapabilityTransitionOutput>;
};
