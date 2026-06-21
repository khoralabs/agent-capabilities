import { expect, test } from "bun:test";
import type { CapabilityLink, RegisteredAgent } from "@khoralabs/agent-capabilities";
import { AgentSessionAbortedError } from "@khoralabs/agent-capabilities";
import type { Span, Tracer } from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";
import { createAgentTelemetry } from "./create-agent-telemetry.js";

type RecordedSpan = {
  name: string;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; attributes?: Record<string, string | number | boolean> }>;
  status?: { code: number; message?: string };
  ended: boolean;
};

function createRecordingTracer(): { tracer: Tracer; spans: RecordedSpan[] } {
  const spans: RecordedSpan[] = [];
  const tracer = {
    startSpan(name: string, options?: { attributes?: Record<string, unknown> }) {
      const span: RecordedSpan = {
        name,
        attributes: { ...(options?.attributes as Record<string, string | number | boolean>) },
        events: [],
        ended: false,
      };
      spans.push(span);
      const api: Span = {
        spanContext: () => ({ traceId: "trace", spanId: "span", traceFlags: 1 }),
        setAttribute(key, value) {
          span.attributes[key] = value as string | number | boolean;
          return api;
        },
        setAttributes(attrs) {
          Object.assign(span.attributes, attrs);
          return api;
        },
        addEvent(eventName, attrs) {
          span.events.push({
            name: eventName,
            attributes: attrs as Record<string, string | number | boolean>,
          });
          return api;
        },
        setStatus(status) {
          span.status = status;
          return api;
        },
        recordException() {
          return api;
        },
        end() {
          span.ended = true;
        },
        updateName() {
          return api;
        },
        addLink() {
          return api;
        },
        addLinks() {
          return api;
        },
        isRecording() {
          return !span.ended;
        },
      };
      return api;
    },
  } as unknown as Tracer;
  return { tracer, spans };
}

const mockAgent: RegisteredAgent = {
  agentId: "agent-1",
  name: "Demo Agent",
  staticHash: "static-hash",
  staticProps: {
    kind: "registered-agent",
    agentId: "agent-1",
    name: "Demo Agent",
    instructions: [],
  },
  staticInstructions: [],
  staticContext: {},
  rootComposable: {} as RegisteredAgent["rootComposable"],
};

const mockLink: CapabilityLink = {
  agentId: "agent-1",
  agentName: "Demo Agent",
  staticHash: "static-hash",
  runtimeHash: "runtime-hash",
  invocationHash: "invocation-hash",
  toolRefs: [
    { toolKey: "search", toolHash: "hash-search" },
    { toolKey: "summarize", toolHash: "hash-summarize" },
  ],
};

test("linkCapture adds tool ref events and mapper attributes", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({
    tracer,
    attributeMappers: {
      capabilityLink: () => ({ "agent.enabled_tools": "search,summarize" }),
      invocationContext: () => ({ "invocation.tenantId": "tenant-1" }),
    },
  });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  tel.linkCapture({
    link: mockLink,
    invocationContext: { tenantId: "tenant-1" },
    sessionContext: { messageId: "msg-1" },
  });
  await tel.sessionHooks.onAfterRun?.({
    agent: mockAgent,
    input: {},
    context: {},
    output: {},
  });

  const session = spans.find((s) => s.name === "agent.session");
  expect(session?.attributes["agent.runtime_hash"]).toBe("runtime-hash");
  expect(session?.attributes["agent.enabled_tools"]).toBe("search,summarize");
  expect(session?.attributes["invocation.tenantId"]).toBe("tenant-1");
  expect(session?.events).toEqual([
    { name: "agent.tool.ref", attributes: { "tool.key": "search", "tool.hash": "hash-search" } },
    {
      name: "agent.tool.ref",
      attributes: { "tool.key": "summarize", "tool.hash": "hash-summarize" },
    },
  ]);
});

test("traceAffordanceEvaluation creates affordance span with tool count", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({ tracer });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  const result = await tel.traceAffordanceEvaluation(async () => ({ link: mockLink, value: 42 }));
  await tel.sessionHooks.onAfterRun?.({
    agent: mockAgent,
    input: {},
    context: {},
    output: result,
  });

  expect(result).toEqual({ link: mockLink, value: 42 });
  const evalSpan = spans.find((s) => s.name === "agent.affordance.evaluate");
  expect(evalSpan?.attributes["agent.tool_count"]).toBe(2);
  expect(evalSpan?.ended).toBe(true);
  expect(evalSpan?.status?.code).toBe(SpanStatusCode.OK);
});

test("sessionContext mapper runs at onAfterContext", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({
    tracer,
    attributeMappers: {
      sessionContext: ({ context }) => ({ "session.tenantId": context.tenantId as string }),
    },
  });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.sessionHooks.onAfterContext?.({
    agent: mockAgent,
    input: {},
    context: { tenantId: "tenant-42" },
  });
  await tel.sessionHooks.onAfterRun?.({
    agent: mockAgent,
    input: {},
    context: { tenantId: "tenant-42" },
    output: {},
  });

  const session = spans.find((s) => s.name === "agent.session");
  expect(session?.attributes["session.tenantId"]).toBe("tenant-42");
});

test("mapper errors do not fail the session", async () => {
  const warnings: unknown[] = [];
  const logger = {
    info: () => {},
    warn: (obj: unknown) => warnings.push(obj),
  } as never;

  const tel = createAgentTelemetry({
    tracer: createRecordingTracer().tracer,
    logger,
    attributeMappers: {
      sessionContext: () => {
        throw new Error("mapper boom");
      },
    },
  });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.sessionHooks.onAfterContext?.({
    agent: mockAgent,
    input: {},
    context: {},
  });
  await tel.sessionHooks.onAfterRun?.({
    agent: mockAgent,
    input: {},
    context: {},
    output: {},
  });
  expect(warnings.length).toBe(1);
});

test("policyTracing spanOnPass execute-only creates pass span at execute phase", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({
    tracer,
    policyTracing: { spanOnPass: "execute-only" },
  });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.pipelineHooks.onPolicyEvaluated?.({
    ok: true,
    policyId: "tier-pro",
    phase: "tool",
    env: {},
  });
  await tel.pipelineHooks.onPolicyEvaluated?.({
    ok: true,
    policyId: "tier-pro",
    phase: "execute",
    toolName: "search",
    env: {},
  });

  const passSpans = spans.filter((s) => s.name === "agent.policy.passed");
  expect(passSpans.length).toBe(1);
  expect(passSpans[0]?.attributes["policy.phase"]).toBe("execute");
});

test("toolPayloads hash-only adds input_hash on tool span", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({
    tracer,
    toolPayloads: { includeInput: "hash-only" },
  });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.pipelineHooks.onToolExecuted?.({
    ok: true,
    toolName: "search",
    input: { query: "hello" },
    output: "results",
    durationMs: 10,
    env: {},
  });

  const toolSpan = spans.find((s) => s.name === "agent.tool.execute");
  expect(toolSpan?.attributes["tool.input_hash"]).toBeString();
  expect(toolSpan?.attributes["tool.input"]).toBeUndefined();
});

test("setSessionAttributes and addSessionEvent attach to active session span", async () => {
  const { tracer, spans } = createRecordingTracer();
  const tel = createAgentTelemetry({ tracer });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  tel.setSessionAttributes({ "domain.planId": "plan-99" });
  tel.addSessionEvent("agent.domain.checkpoint", { step: "evaluated" });
  await tel.sessionHooks.onAfterRun?.({
    agent: mockAgent,
    input: {},
    context: {},
    output: {},
  });

  const session = spans.find((s) => s.name === "agent.session");
  expect(session?.attributes["domain.planId"]).toBe("plan-99");
  expect(session?.events).toContainEqual({
    name: "agent.domain.checkpoint",
    attributes: { step: "evaluated" },
  });
});

test("cancelled session ends span with OK status and cancelled attribute", async () => {
  const { tracer, spans } = createRecordingTracer();
  const sessionRunCounts: Array<{ ok: boolean | string }> = [];
  const meter = {
    createCounter: () => ({
      add(_value: number, attrs: { ok: boolean | string }) {
        sessionRunCounts.push({ ok: attrs.ok });
      },
    }),
    createHistogram: () => ({ record: () => {} }),
  };
  const logs: Array<{ msg: string }> = [];
  const logger = {
    info: (_obj: unknown, msg: string) => logs.push({ msg }),
    error: (_obj: unknown, msg: string) => logs.push({ msg }),
    warn: () => {},
    debug: () => {},
  } as never;

  const tel = createAgentTelemetry({ tracer, meter: meter as never, logger });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.sessionHooks.onError?.({
    agent: mockAgent,
    input: {},
    context: {},
    error: new AgentSessionAbortedError(),
  });

  const session = spans.find((s) => s.name === "agent.session");
  expect(session?.attributes["agent.session.cancelled"]).toBe(true);
  expect(session?.status?.code).toBe(SpanStatusCode.OK);
  expect(sessionRunCounts).toEqual([{ ok: "cancelled" }]);
  expect(logs.some((l) => l.msg === "agent.session.cancelled")).toBe(true);
  expect(logs.some((l) => l.msg === "agent.session.error")).toBe(false);
});

test("non-abort error keeps ERROR span status", async () => {
  const { tracer, spans } = createRecordingTracer();
  const sessionRunCounts: Array<{ ok: boolean | string }> = [];
  const meter = {
    createCounter: () => ({
      add(_value: number, attrs: { ok: boolean | string }) {
        sessionRunCounts.push({ ok: attrs.ok });
      },
    }),
    createHistogram: () => ({ record: () => {} }),
  };
  const tel = createAgentTelemetry({ tracer, meter: meter as never });

  await tel.sessionHooks.onStart?.({ agent: mockAgent, input: {} });
  await tel.sessionHooks.onError?.({
    agent: mockAgent,
    input: {},
    context: {},
    error: new Error("runner failed"),
  });

  const session = spans.find((s) => s.name === "agent.session");
  expect(session?.attributes["agent.session.cancelled"]).toBeUndefined();
  expect(session?.status?.code).toBe(SpanStatusCode.ERROR);
  expect(sessionRunCounts).toEqual([{ ok: false }]);
});
