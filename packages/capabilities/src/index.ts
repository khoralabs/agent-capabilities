export type {
  AgentRegistry,
  AgentSession,
  AgentSessionHooks,
  CreateAgentRegistryOptions,
  CreateSessionOptions,
  RegisterAgentOptions,
  RegisteredAgentEntry,
  RegisteredSessionRunner,
  SessionContext,
  SessionContextInput,
  SessionRunner,
} from "./agent/agent-registry.js";
export { createAgentRegistry } from "./agent/agent-registry.js";
export type {
  AffordancePolicyIdsChange,
  AffordancePolicyIdsDiff,
  CapabilityLinkField,
  CapabilityLinkFieldChange,
  CapabilityLinksDiff,
  PolicyEvaluationResultsDiff,
  ToolRefRow,
  ToolRefsDiff,
} from "./agent/capability-diff.js";
export {
  diffAffordancePolicyIds,
  diffCapabilityLinks,
  diffPolicyEvaluationSnapshots,
  diffToolRefs,
  explainCapabilityLinkRelationship,
  formatHashShort,
} from "./agent/capability-diff.js";
export type {
  CapabilityLink,
  CreateCapabilityLinkArgs,
} from "./agent/capability-link.js";
export { computeFullCapabilityLink, createCapabilityLink } from "./agent/capability-link.js";
export {
  evaluateRegisteredAgentAffordances,
  type RegisteredAgentAffordances,
} from "./agent/evaluate-registered-agent-affordances.js";
export {
  type CreateRegisteredAgentArgs,
  createRegisteredAgent,
} from "./agent/registered-agent.js";
export type {
  CapabilityDiffJsonReport,
  CapabilityDiffReportLabels,
} from "./cli/capability-diff-report.js";
export {
  buildCapabilityDiffJsonReport,
  formatCapabilityDiffReport,
} from "./cli/capability-diff-report.js";
export type { DiffInputKind, DiffSources } from "./cli/parse-diff-input.js";
export { extractDiffSources, parseDiffInput } from "./cli/parse-diff-input.js";
export type {
  RuntimeCapabilityCanonicalPayload,
  ToolCapabilityCanonicalPayload,
} from "./hashing/canonical-payloads.js";
export {
  runtimeCapabilityCanonicalPayload,
  toolSpecCanonicalPayload,
} from "./hashing/canonical-payloads.js";
export { hashPlainObject, schemaToHashInput } from "./hashing/hash.js";
export type {
  InvocationContextCanonicalPayload,
  InvocationContextRecommended,
  NormalizeInvocationContextForHashOptions,
} from "./hashing/invocation-context.js";
export {
  computeInvocationContextHash,
  invocationContextCanonicalPayload,
  normalizeInvocationContextForHash,
} from "./hashing/invocation-context.js";
export {
  collectToolStaticHashes,
  computeRuntimeCapabilitiesFromEvaluation,
  computeRuntimeHash,
  hashRuntimeToolBinding,
  hashToolSpecStatic,
  resolveRuntimeToolRefs,
} from "./hashing/runtime-hashes.js";
export type {
  AffordanceSnapshotEnvelopeRow,
  CapabilitiesOpContext,
  CapabilityLinkRow,
  RecordTurnAttributionArgs,
  RecordTurnAttributionResult,
  RegisteredAgentRegistrationRow,
} from "./persistence/index.js";
export {
  capabilityLinkToRow,
  createMemoryAgentCapabilitiesPersistence,
  defaultOpContext,
  envelopeToRow,
  recordTurnAttribution,
  registeredAgentToRegistrationRow,
} from "./persistence/index.js";
export type { AgentCapabilitiesPersistence } from "./persistence/interface.js";
export { gateToolPoliciesAtExecute } from "./policy/execute-gate.js";
export {
  evaluatePolicyWithHooks,
  mergeToolPipelineHooks,
} from "./policy/pipeline-hooks.js";
export type { PolicyOptions } from "./policy/policy.js";
export { policy } from "./policy/policy.js";
export type {
  AgentRuntimeSnapshot,
  AgentSnapshotEnvelope,
  CaptureAgentSnapshotEnvelopeArgs,
  CaptureAgentSnapshotEnvelopeResult,
  CaptureAgentTurnArgs,
  CaptureAgentTurnResult,
  HydrateAffordancesBindTool,
  PolicyEvaluationSnapshot,
  PolicySnapshotMode,
  RegisteredAgentAffordancesWire,
  RegisteredAgentWire,
  ToolSpecWire,
} from "./snapshot/index.js";
export {
  AGENT_SNAPSHOT_ENVELOPE_VERSION,
  affordancesToWire,
  captureAgentRuntimeSnapshot,
  captureAgentSnapshotEnvelope,
  capturePolicyResults,
  hashToolSpecWire,
  hydrateAffordances,
  registeredAgentToWire,
  toolCapabilityPayloadFromWire,
  toolkitContextToWire,
  toolSpecToWire,
} from "./snapshot/index.js";
export type {
  StandardSchemaV1,
  StandardTypedV1,
} from "./standard-schema.js";
export { elapsedMs } from "./timing.js";
export type {
  ToolErrorOutput,
  ToolOutput,
  ToolSuccessOutput,
} from "./tool/output.js";
export { withFormattedResults } from "./tool/output.js";
export type { ExtractToolStaticEnv, ToolStaticProps } from "./tool/tool.js";
export { tool } from "./tool/tool.js";
export type {
  RegisteredToolEntry,
  ToolRegistry,
} from "./tool/tool-registry.js";
export { createToolRegistry } from "./tool/tool-registry.js";
export { hashToolComposableStatic } from "./tool/tool-static.js";
export { assembleToolkitAgentInstructions } from "./toolkit/assemble-toolkit-instructions.js";
export type {
  AnyComposable,
  ComposableWithChildren,
  EnvFromMembers,
  ExtractComposableEnv,
  ExtractComposableTools,
  ToolkitStaticProps,
  ToolMapFromMembers,
} from "./toolkit/toolkit.js";
export {
  dynamicToolkit,
  evaluateComposable,
  toolkit,
} from "./toolkit/toolkit.js";
export type {
  AgentStaticProps,
  Composable,
  PolicyEvaluatedPayload,
  PolicyEvaluatedPhase,
  PolicyExecuteBinding,
  PolicyResultMap,
  RegisteredAgent,
  SharedPolicy,
  ToolExecutedPayload,
  ToolkitContext,
  ToolkitResult,
  ToolPipelineHooks,
  ToolRuntimeContext,
  ToolSpec,
} from "./types.js";
