$version: "2"

namespace agent.capabilities

/// Whether serialized policy results are authoritative for replay or advisory only.
enum PolicySnapshotMode {
    @enumValue("authoritative")
    AUTHORITATIVE

    @enumValue("hint")
    HINT
}

/// JSON-safe policy closure at capture time (no live policy objects).
/// **authoritative:** `results` are ground truth for replay and audit.
/// **hint:** policy re-evaluation may diverge; `results` are a capture-time cache.
structure PolicyEvaluationSnapshot {
    mode: PolicySnapshotMode
    /// Policy id → allowed.
    results: PolicyResultsMap
    capturedAt: Long
    policyBundleId: String
    policyEngineVersion: String
}

map PolicyResultsMap {
    key: String
    value: Boolean
}

map AffordanceToolsMap {
    key: String
    value: ToolSpecWire
}

/// Post-evaluation affordances without executable handlers.
structure RegisteredAgentAffordancesWire {
    instructions: String
    tools: AffordanceToolsMap
}

/// Runtime slice: capability link, tool refs, affordances, policy closure, and toolkit context.
structure AgentRuntimeSnapshot {
    link: CapabilityLink
    toolRefs: ToolRefRowList
    affordances: RegisteredAgentAffordancesWire
    policy: PolicyEvaluationSnapshot
    /// JSON-safe toolkit context subset (e.g. serialized env). Pipeline hooks are omitted.
    toolkitContext: Document
}

/// Versioned envelope for layered serialization of static, policy, runtime, and session context.
structure AgentSnapshotEnvelope {
    schemaVersion: String
    static: RegisteredAgentWire
    policy: PolicyEvaluationSnapshot
    runtime: AgentRuntimeSnapshot
    context: Document
}
