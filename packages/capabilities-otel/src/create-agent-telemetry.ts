import type { CapabilityLink, PolicyEvaluatedPayload } from "@khoralabs/agent-capabilities";
import {
  type Context,
  type Counter,
  context,
  type Histogram,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { Logger } from "pino";
import { toolPayloadAttributes } from "./payloads.js";
import type {
  AgentTelemetry,
  AgentTelemetryOptions,
  LinkCaptureArgs,
  PolicyTracing,
  SpanAttributes,
} from "./types.js";

const TRACER_NAME = "@khoralabs/agent-capabilities-otel";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function endSessionSpan(span: Span, ok: boolean, error?: unknown): void {
  if (!ok && error !== undefined) {
    span.recordException(error instanceof Error ? error : new Error(errorMessage(error)));
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage(error) });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

function applyAttributes(span: Span | undefined, attrs: SpanAttributes | undefined): void {
  if (!span || !attrs) return;
  span.setAttributes(attrs);
}

function runMapper<T>(
  mapper: ((arg: T) => SpanAttributes | undefined) | undefined,
  arg: T,
  span: Span | undefined,
  logger: Logger | undefined,
  label: string,
): void {
  if (!mapper || !span) return;
  try {
    applyAttributes(span, mapper(arg));
  } catch (err) {
    logger?.warn({ err: errorMessage(err), mapper: label }, "agent.telemetry.mapper.error");
  }
}

function policySpanAttributes(event: PolicyEvaluatedPayload): SpanAttributes {
  return {
    "policy.id": event.policyId,
    "policy.phase": event.phase,
    ...(event.toolName !== undefined ? { "tool.name": event.toolName } : {}),
    ...(event.composableName !== undefined ? { "composable.name": event.composableName } : {}),
    ...(event.error !== undefined ? { "policy.error": event.error } : {}),
  };
}

function shouldSpanOnPass(
  policyTracing: PolicyTracing | undefined,
  event: PolicyEvaluatedPayload,
): boolean {
  const mode = policyTracing?.spanOnPass ?? false;
  if (mode === true) return true;
  if (mode === "execute-only") return event.phase === "execute";
  return false;
}

export function createAgentTelemetry(options: AgentTelemetryOptions = {}): AgentTelemetry {
  const tracer = options.tracer ?? trace.getTracer(TRACER_NAME);
  const logger = options.logger;
  const mappers = options.attributeMappers;
  const toolPayloads = options.toolPayloads;
  const policyTracing = options.policyTracing;
  const spanHooks = options.spanHooks;

  let sessionSpan: Span | undefined;
  let sessionContext: Context | undefined;
  let sessionStartMs = 0;
  let sessionAgentId: string | undefined;

  const toolExecutions: Counter | undefined = options.meter?.createCounter(
    "agent.tool.executions",
    { description: "Tool execution count" },
  );
  const toolDurationMs: Histogram | undefined = options.meter?.createHistogram(
    "agent.tool.duration_ms",
    { description: "Tool execution duration in milliseconds", unit: "ms" },
  );
  const sessionRuns: Counter | undefined = options.meter?.createCounter("agent.session.runs", {
    description: "Agent session run count",
  });

  function setSessionAttributes(attrs: SpanAttributes): void {
    applyAttributes(sessionSpan, attrs);
  }

  function addSessionEvent(name: string, attrs?: SpanAttributes): void {
    sessionSpan?.addEvent(name, attrs);
  }

  function linkCapabilityLink(link: CapabilityLink): void {
    if (sessionSpan) {
      sessionSpan.setAttributes({
        "agent.runtime_hash": link.runtimeHash,
        "agent.tool_count": link.toolRefs.length,
        ...(link.invocationHash !== undefined
          ? { "agent.invocation_hash": link.invocationHash }
          : {}),
      });
    }
    logger?.debug(
      {
        runtimeHash: link.runtimeHash,
        invocationHash: link.invocationHash,
        toolCount: link.toolRefs.length,
        agentId: sessionAgentId ?? link.agentId,
      },
      "agent.capability_link",
    );
  }

  function linkCapture(args: LinkCaptureArgs): void {
    linkCapabilityLink(args.link);
    runMapper(mappers?.capabilityLink, args.link, sessionSpan, logger, "capabilityLink");
    if (args.invocationContext !== undefined) {
      runMapper(
        mappers?.invocationContext,
        args.invocationContext,
        sessionSpan,
        logger,
        "invocationContext",
      );
    }
    const refs = args.toolRefs ?? args.link.toolRefs;
    for (const ref of refs) {
      sessionSpan?.addEvent("agent.tool.ref", {
        "tool.key": ref.toolKey,
        "tool.hash": ref.toolHash,
      });
    }
    if (args.sessionContext !== undefined) {
      logger?.debug({ sessionContext: args.sessionContext }, "agent.session.context");
    }
  }

  async function traceAffordanceEvaluation<T>(fn: () => Promise<T>): Promise<T> {
    const parentContext = sessionContext ?? context.active();
    const span = tracer.startSpan("agent.affordance.evaluate", {}, parentContext);
    const evalContext = trace.setSpan(parentContext, span);
    try {
      const result = await context.with(evalContext, fn);
      if (result !== null && typeof result === "object" && "link" in result) {
        const link = (result as { link: CapabilityLink }).link;
        span.setAttribute("agent.tool_count", link.toolRefs.length);
      }
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(errorMessage(err)));
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage(err) });
      throw err;
    } finally {
      span.end();
    }
  }

  const sessionHooks: AgentTelemetry["sessionHooks"] = {
    onStart({ agent }) {
      sessionStartMs = Date.now();
      sessionAgentId = agent.agentId;
      sessionSpan = tracer.startSpan("agent.session", {
        attributes: {
          "agent.id": agent.agentId,
          "agent.name": agent.name,
          "agent.static_hash": agent.staticHash,
        },
      });
      sessionContext = trace.setSpan(context.active(), sessionSpan);
      spanHooks?.onSessionSpanStart?.(sessionSpan, { agent });
      logger?.info(
        { agentId: agent.agentId, agentName: agent.name, staticHash: agent.staticHash },
        "agent.session.start",
      );
    },

    onAfterContext({ agent, input, context: ctx }) {
      runMapper(
        mappers?.sessionContext,
        { agent, input, context: ctx },
        sessionSpan,
        logger,
        "sessionContext",
      );
    },

    onAfterRun({ agent }) {
      const durationMs = Date.now() - sessionStartMs;
      if (sessionSpan) {
        sessionSpan.setAttribute("agent.session.duration_ms", durationMs);
        spanHooks?.onSessionSpanEnd?.(sessionSpan, { agent, ok: true, durationMs });
        endSessionSpan(sessionSpan, true);
        sessionSpan = undefined;
        sessionContext = undefined;
      }
      sessionRuns?.add(1, { "agent.id": agent.agentId, ok: true });
      logger?.info({ agentId: agent.agentId, durationMs }, "agent.session.end");
    },

    onError({ agent, error }) {
      const durationMs = Date.now() - sessionStartMs;
      if (sessionSpan) {
        sessionSpan.setAttribute("agent.session.duration_ms", durationMs);
        spanHooks?.onSessionSpanEnd?.(sessionSpan, { agent, ok: false, durationMs });
        endSessionSpan(sessionSpan, false, error);
        sessionSpan = undefined;
        sessionContext = undefined;
      }
      sessionRuns?.add(1, { "agent.id": agent.agentId, ok: false });
      logger?.error(
        {
          agentId: agent.agentId,
          durationMs,
          err: error instanceof Error ? error : errorMessage(error),
        },
        "agent.session.error",
      );
    },
  };

  const pipelineHooks: AgentTelemetry["pipelineHooks"] = {
    async onToolExecuted(event) {
      const endTime = Date.now();
      const startTime = event.durationMs !== undefined ? endTime - event.durationMs : endTime;
      const parentContext = sessionContext ?? context.active();
      const baseAttrs: SpanAttributes = {
        "tool.name": event.toolName,
        "tool.ok": event.ok,
      };
      if (toolPayloads) {
        const payloadAttrs = await toolPayloadAttributes(event, toolPayloads);
        Object.assign(baseAttrs, payloadAttrs);
      }
      const span = tracer.startSpan(
        "agent.tool.execute",
        { startTime, attributes: baseAttrs },
        parentContext,
      );
      runMapper(mappers?.toolExecuted, event, span, logger, "toolExecuted");
      if (!event.ok && event.error !== undefined) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: event.error });
      }
      spanHooks?.onToolSpanEnd?.(span, event);
      span.end(endTime);

      toolExecutions?.add(1, { "tool.name": event.toolName, "tool.ok": event.ok });
      if (event.durationMs !== undefined) {
        toolDurationMs?.record(event.durationMs, { "tool.name": event.toolName });
      }

      if (event.ok) {
        logger?.info(
          { toolName: event.toolName, durationMs: event.durationMs },
          "agent.tool.executed",
        );
      } else {
        logger?.error(
          { toolName: event.toolName, durationMs: event.durationMs, error: event.error },
          "agent.tool.error",
        );
      }
    },

    onPolicyEvaluated(event) {
      if (event.ok && !shouldSpanOnPass(policyTracing, event)) {
        logger?.debug(
          {
            policyId: event.policyId,
            phase: event.phase,
            toolName: event.toolName,
            composableName: event.composableName,
          },
          "agent.policy.passed",
        );
        return;
      }

      const parentContext = sessionContext ?? context.active();
      const spanName = event.ok ? "agent.policy.passed" : "agent.policy.denied";
      const span = tracer.startSpan(
        spanName,
        { attributes: policySpanAttributes(event) },
        parentContext,
      );
      runMapper(mappers?.policyEvaluated, event, span, logger, "policyEvaluated");
      if (event.ok) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: event.error ?? "policy denied",
        });
      }
      spanHooks?.onPolicySpanEnd?.(span, event);
      span.end();

      if (event.ok) {
        logger?.debug(
          {
            policyId: event.policyId,
            phase: event.phase,
            toolName: event.toolName,
            composableName: event.composableName,
          },
          "agent.policy.passed",
        );
      } else {
        logger?.warn(
          {
            policyId: event.policyId,
            phase: event.phase,
            toolName: event.toolName,
            composableName: event.composableName,
            error: event.error,
          },
          "agent.policy.denied",
        );
      }
    },
  };

  return {
    sessionHooks,
    pipelineHooks,
    linkCapabilityLink,
    linkCapture,
    setSessionAttributes,
    addSessionEvent,
    traceAffordanceEvaluation,
  };
}

export type { AgentTelemetry, AgentTelemetryOptions, LinkCaptureArgs } from "./types.js";
