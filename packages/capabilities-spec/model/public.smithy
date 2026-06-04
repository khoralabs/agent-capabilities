$version: "2"

namespace agent.capabilities

@documentation("""
Comparison and explanation over wire shapes already materialized as hashes and refs.

Does not evaluate composables, run policies, or compute hashes. Hosts supply
{@link CapabilityLink} and {@link ToolRefRow} values from their runtime pipeline.
""")
service AgentCapabilitiesPublic {
    version: "2026-04-12"
    operations: [
        DiffToolRefs
        DiffCapabilityLinks
        ExplainCapabilityLinkRelationship
    ]
}

operation DiffToolRefs {
    input: DiffToolRefsInput
    output: DiffToolRefsOutput
}

structure DiffToolRefsInput {
    first: ToolRefRowList
    second: ToolRefRowList
}

structure DiffToolRefsOutput {
    diff: ToolRefsDiff
}

operation DiffCapabilityLinks {
    input: DiffCapabilityLinksInput
    output: DiffCapabilityLinksOutput
}

structure DiffCapabilityLinksInput {
    first: CapabilityLink
    second: CapabilityLink
}

structure DiffCapabilityLinksOutput {
    diff: CapabilityLinksDiff
}

operation ExplainCapabilityLinkRelationship {
    input: ExplainCapabilityLinkRelationshipInput
    output: ExplainCapabilityLinkRelationshipOutput
}

structure ExplainCapabilityLinkRelationshipInput {
    first: CapabilityLink
    second: CapabilityLink
}

structure ExplainCapabilityLinkRelationshipOutput {
    /// Non-i18n diagnostic string for dashboards and logs.
    explanation: String
}
