$version: "2"

namespace agent.capabilities

// --- Lists ---

list StringList {
    member: String
}

list ToolRefRowList {
    member: ToolRefRow
}

list ToolKeyHashPairList {
    member: ToolKeyHashPair
}

list InstructionLineList {
    member: String
}

list PolicyIdList {
    member: String
}

list CapabilityLinkFieldList {
    member: CapabilityLinkField
}

list CapabilityLinkFieldChangeList {
    member: CapabilityLinkFieldChange
}

list HashChangeList {
    member: ToolRefHashChange
}

// --- Interchange (handlers omitted) ---

/// Serializable tool definition for hashing, storage, and replay.
structure ToolSpecWire {
    name: String
    description: String
    /// Instruction text; canonical hashing splits on `\\n\\n` into sorted lines.
    instructions: String
    /// JSON Schema or equivalent schema document (e.g. Standard Schema projection).
    inputSchema: Document
    /// Sorted policy ids; must match static tool hash inputs for runtime parity.
    policyIds: PolicyIdList
}

/// Registered agent template without the composable tree.
structure RegisteredAgentWire {
    agentId: String
    name: String
    staticHash: String
    staticInstructions: StringList
    staticContext: Document
}

// --- Canonical pre-hash payloads ---

structure RuntimeCapabilityCanonicalPayload {
    /// Must be the literal `runtime`.
    kind: String
    tools: ToolKeyHashPairList
}

structure ToolKeyHashPair {
    name: String
    hash: String
}

structure ToolCapabilityCanonicalPayload {
    /// Must be the literal `tool`.
    kind: String
    name: String
    description: String
    schema: Document
    /// Sorted instruction lines (split from wire `instructions` by `\\n\\n`).
    instructions: InstructionLineList
    policies: PolicyIdList
}

/// Input to invocation-context hashing before SHA-256.
structure InvocationContextCanonicalPayload {
    /// Must be the literal `invocation`.
    kind: String
    /// Normalized JSON-only map (sorted keys at every object level; no functions).
    context: Document
}

/// Recommended optional keys for host `invocationContext` maps (conventions only; not validated).
/// See repository `docs/invocation-context.md`. Hosts may add arbitrary plain keys.
structure InvocationContextRecommended {
    traceId: String
    sessionId: String
    messageId: String
    tenantId: String
    actorId: String
    subjectId: String
    personaSlug: String
    policyBundleId: String
}

// --- Capability link & diffs ---

/// Attribution record: template fingerprint, effective runtime tools, optional per-invocation binding.
structure CapabilityLink {
    agentId: String
    agentName: String
    staticHash: String
    runtimeHash: String
    @documentation("Optional. Per-run binding fingerprint; omit when not computed. Not part of staticHash.")
    invocationHash: String
    @documentation("Per-tool runtime refs for this link (derivable from runtimeHash; included for single-row persistence).")
    toolRefs: ToolRefRowList
}

structure ToolRefRow {
    toolKey: String
    toolHash: String
}

structure ToolRefsDiff {
    onlyInFirst: ToolRefRowList
    onlyInSecond: ToolRefRowList
    hashChanged: HashChangeList
}

structure ToolRefHashChange {
    toolKey: String
    firstHash: String
    secondHash: String
}

enum CapabilityLinkField {
    @enumValue("agentId")
    AGENT_ID

    @enumValue("agentName")
    AGENT_NAME

    @enumValue("staticHash")
    STATIC_HASH

    @enumValue("runtimeHash")
    RUNTIME_HASH

    @enumValue("invocationHash")
    INVOCATION_HASH
}

structure CapabilityLinkFieldChange {
    field: CapabilityLinkField
    first: String
    second: String
}

structure CapabilityLinksDiff {
    unchanged: CapabilityLinkFieldList
    changed: CapabilityLinkFieldChangeList
}

// --- Static hash payloads (composable tree leaves and nodes) ---

structure ToolStaticHashPayload {
    kind: String
    name: String
    description: String
    schema: Document
    instructions: InstructionLineList
    policies: PolicyIdList
}

structure ToolkitMemberHash {
    name: String
    hash: String
}

list ToolkitMemberHashList {
    member: ToolkitMemberHash
}

structure ToolkitStaticHashPayload {
    kind: String
    name: String
    instructions: String
    members: ToolkitMemberHashList
}

structure DynamicToolkitStaticHashPayload {
    kind: String
    name: String
    instructions: String
    policies: PolicyIdList
}

// --- Policy & pipeline telemetry (not part of static hashes) ---

enum PolicyEvaluatedPhase {
    @enumValue("toolkit")
    TOOLKIT

    @enumValue("tool")
    TOOL

    @enumValue("dynamicToolkit")
    DYNAMIC_TOOLKIT

    @enumValue("execute")
    EXECUTE
}

structure PolicyEvaluatedPayload {
    ok: Boolean
    policyId: String
    phase: PolicyEvaluatedPhase
    toolName: String
    composableName: String
    error: String
}

structure ToolExecutedPayload {
    ok: Boolean
    toolName: String
    input: Document
    output: Document
    error: String
    durationMs: Double
}

// --- Persistence rows ---

structure CapabilitiesOpContext {
    /// Epoch milliseconds (wall clock or host-defined clock).
    now: Long
    tenantId: String
    actorId: String
}

structure CapabilityLinkRow {
    linkId: String
    sessionId: String
    _ts_created: Long
    agentId: String
    agentName: String
    staticHash: String
    runtimeHash: String
    invocationHash: String
    @documentation("Optional denormalized tool refs; may also live on RuntimeSnapshotRow.")
    toolRefs: ToolRefRowList
    /// Host metadata (e.g. raw invocation context, source, indices). Not hashed in CapabilityLink.
    metadata: Document
}

structure RuntimeSnapshotRow {
    snapshotId: String
    sessionId: String
    _ts_created: Long
    runtimeHash: String
    toolRefs: ToolRefRowList
    metadata: Document
}

structure RegisteredAgentRegistrationRow {
    registrationId: String
    agentId: String
    staticHash: String
    staticProps: Document
    _ts_created: Long
}

list CapabilityLinkRowList {
    member: CapabilityLinkRow
}
