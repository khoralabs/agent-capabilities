$version: "2"

namespace agent.capabilities

@documentation("""
Storage contract for agent capabilities attribution: registered templates, session
capability links, runtime tool-ref snapshots, affordance envelopes, and lineage transitions.

**Identifiers:** `linkId`, `sessionId`, `registrationId`, `snapshotId`, `tenantId`, and
`actorId` are opaque host-defined strings. Uniqueness constraints and indexes are host policy.

**Transactions:** One outer transaction per logical session update is recommended; nesting
depends on the storage backend.

**Idempotency:** `UpsertRegisteredAgentSnapshot` should be idempotent for the same
`(agentId, staticHash)`. `RecordSessionCapabilityLink` may append or upsert; duplicate
`(sessionId, staticHash, runtimeHash)` rows may be retained for audit or deduplicated.

**Capability lineage:** {@link CapabilityLink} and {@link CapabilityLinkRow} include
optional `invocationHash` — a third fingerprint for per-invocation binding separate from
`staticHash` and `runtimeHash`. Optional `toolRefs` on the link row denormalize per-tool
runtime hashes; hosts may instead store refs only on {@link RuntimeSnapshotRow}.

**Snapshots:** `RecordAffordanceSnapshotEnvelope` persists a versioned
{@link AgentSnapshotEnvelope} (`envelope` as `Document`).

**Transitions:** `RecordCapabilityTransition` links two {@link CapabilityLinkRow} ids for
replay and audit graphs.

**Orchestration:** Session hooks, `run` handlers, and live composable graphs are host-local;
this service stores templates and attribution rows only. Reference TS pairs an in-memory
backend (`:memory:`) with a session host via {@link createAgentRegistry}.
""")
service AgentCapabilitiesPersistenceService {
    version: "2026-04-12"
    operations: [
        UpsertRegisteredAgentSnapshot
        GetLatestRegisteredAgentForAgent
        RecordSessionCapabilityLink
        GetLatestCapabilityLinkForSession
        ListCapabilityLinksForAgent
        RecordRuntimeToolRefSnapshot
        RecordAffordanceSnapshotEnvelope
        GetAffordanceSnapshotEnvelope
        RecordCapabilityTransition
    ]
}

operation UpsertRegisteredAgentSnapshot {
    input: UpsertRegisteredAgentSnapshotInput
    output: UpsertRegisteredAgentSnapshotOutput
}

structure UpsertRegisteredAgentSnapshotInput {
    op: CapabilitiesOpContext
    row: RegisteredAgentRegistrationRow
}

structure UpsertRegisteredAgentSnapshotOutput {
    registrationId: String
}

operation GetLatestRegisteredAgentForAgent {
    input: GetLatestRegisteredAgentForAgentInput
    output: GetLatestRegisteredAgentForAgentOutput
}

structure GetLatestRegisteredAgentForAgentInput {
    agentId: String
}

structure GetLatestRegisteredAgentForAgentOutput {
    /// Present when a registration exists for the agent; omitted when none.
    row: RegisteredAgentRegistrationRow
}

operation RecordSessionCapabilityLink {
    input: RecordSessionCapabilityLinkInput
    output: RecordSessionCapabilityLinkOutput
}

structure RecordSessionCapabilityLinkInput {
    op: CapabilitiesOpContext
    link: CapabilityLinkRow
}

structure RecordSessionCapabilityLinkOutput {
    linkId: String
}

operation GetLatestCapabilityLinkForSession {
    input: GetLatestCapabilityLinkForSessionInput
    output: GetLatestCapabilityLinkForSessionOutput
}

structure GetLatestCapabilityLinkForSessionInput {
    sessionId: String
}

structure GetLatestCapabilityLinkForSessionOutput {
    /// Present when a row exists for the session; omitted when none.
    link: CapabilityLinkRow
}

operation ListCapabilityLinksForAgent {
    input: ListCapabilityLinksForAgentInput
    output: ListCapabilityLinksForAgentOutput
}

structure ListCapabilityLinksForAgentInput {
    agentId: String
    /// Opaque pagination or filter (e.g. cursor, `since` timestamp).
    query: Document
}

structure ListCapabilityLinksForAgentOutput {
    links: CapabilityLinkRowList
    nextPage: Document
}

operation RecordRuntimeToolRefSnapshot {
    input: RecordRuntimeToolRefSnapshotInput
    output: RecordRuntimeToolRefSnapshotOutput
}

structure RecordRuntimeToolRefSnapshotInput {
    op: CapabilitiesOpContext
    row: RuntimeSnapshotRow
}

structure RecordRuntimeToolRefSnapshotOutput {
    snapshotId: String
}

structure AffordanceSnapshotEnvelopeRow {
    snapshotId: String
    sessionId: String
    _ts_created: Long
    schemaVersion: String
    /// Full {@link AgentSnapshotEnvelope} as JSON (`Document`).
    envelope: Document
    metadata: Document
}

operation RecordAffordanceSnapshotEnvelope {
    input: RecordAffordanceSnapshotEnvelopeInput
    output: RecordAffordanceSnapshotEnvelopeOutput
}

structure RecordAffordanceSnapshotEnvelopeInput {
    op: CapabilitiesOpContext
    row: AffordanceSnapshotEnvelopeRow
}

structure RecordAffordanceSnapshotEnvelopeOutput {
    snapshotId: String
}

operation GetAffordanceSnapshotEnvelope {
    input: GetAffordanceSnapshotEnvelopeInput
    output: GetAffordanceSnapshotEnvelopeOutput
}

structure GetAffordanceSnapshotEnvelopeInput {
    snapshotId: String
}

structure GetAffordanceSnapshotEnvelopeOutput {
    /// Omitted when `snapshotId` is unknown.
    row: AffordanceSnapshotEnvelopeRow
}

structure CapabilityTransitionRow {
    transitionId: String
    sessionId: String
    fromLinkId: String
    toLinkId: String
    _ts_created: Long
    metadata: Document
}

operation RecordCapabilityTransition {
    input: RecordCapabilityTransitionInput
    output: RecordCapabilityTransitionOutput
}

structure RecordCapabilityTransitionInput {
    op: CapabilitiesOpContext
    row: CapabilityTransitionRow
}

structure RecordCapabilityTransitionOutput {
    transitionId: String
}
