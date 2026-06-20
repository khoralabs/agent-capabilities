import type {
  AgentSessionHooks,
  CapabilityLink,
  PolicyEvaluatedPayload,
  RegisteredAgent,
  SessionContext,
  ToolExecutedPayload,
  ToolPipelineHooks,
} from "@khoralabs/agent-capabilities";
import type { Meter, Span, Tracer } from "@opentelemetry/api";
import type { Logger } from "pino";

export type SpanAttributeValue = string | number | boolean;
export type SpanAttributes = Record<string, SpanAttributeValue>;

export type AgentTelemetryAttributeMappers = {
  sessionContext?: (args: {
    agent: RegisteredAgent;
    input: unknown;
    context: SessionContext;
  }) => SpanAttributes | undefined;
  invocationContext?: (ctx: unknown) => SpanAttributes | undefined;
  capabilityLink?: (link: CapabilityLink) => SpanAttributes | undefined;
  toolExecuted?: (event: ToolExecutedPayload & { env: unknown }) => SpanAttributes | undefined;
  policyEvaluated?: (
    event: PolicyEvaluatedPayload & { env: unknown },
  ) => SpanAttributes | undefined;
};

export type ToolPayloadTracing = {
  includeInput?: boolean | "hash-only";
  includeOutput?: boolean | "hash-only";
  redact?: (value: unknown, path: string) => unknown;
  maxStringLength?: number;
};

export type PolicyTracing = {
  spanOnPass?: boolean | "execute-only";
};

export type AgentTelemetrySpanHooks = {
  onSessionSpanStart?: (span: Span, args: { agent: RegisteredAgent }) => void;
  onSessionSpanEnd?: (
    span: Span,
    args: { agent: RegisteredAgent; ok: boolean; durationMs: number },
  ) => void;
  onToolSpanEnd?: (span: Span, event: ToolExecutedPayload & { env: unknown }) => void;
  onPolicySpanEnd?: (span: Span, event: PolicyEvaluatedPayload & { env: unknown }) => void;
};

export type AgentTelemetryOptions = {
  tracer?: Tracer;
  meter?: Meter;
  logger?: Logger;
  attributeMappers?: AgentTelemetryAttributeMappers;
  toolPayloads?: ToolPayloadTracing;
  policyTracing?: PolicyTracing;
  spanHooks?: AgentTelemetrySpanHooks;
};

export type LinkCaptureArgs = {
  link: CapabilityLink;
  toolRefs?: Array<{ toolKey: string; toolHash: string }>;
  invocationContext?: unknown;
  sessionContext?: Record<string, unknown>;
};

export type AgentTelemetry = {
  sessionHooks: AgentSessionHooks;
  pipelineHooks: ToolPipelineHooks;
  linkCapabilityLink: (link: CapabilityLink) => void;
  linkCapture: (args: LinkCaptureArgs) => void;
  setSessionAttributes: (attrs: SpanAttributes) => void;
  addSessionEvent: (name: string, attrs?: SpanAttributes) => void;
  traceAffordanceEvaluation: <T>(fn: () => Promise<T>) => Promise<T>;
};
