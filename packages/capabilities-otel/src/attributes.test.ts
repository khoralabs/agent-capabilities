import { expect, test } from "bun:test";
import {
  capabilityLinkAttributes,
  invocationContextAttributes,
  sessionContextAttributes,
  toSpanAttributes,
} from "./attributes.js";

test("toSpanAttributes flattens primitives with prefix and allowlist", () => {
  const attrs = toSpanAttributes(
    { tenantId: "t1", subjectId: "s1", nested: { x: 1 }, count: 3, ok: true },
    { allowlist: ["tenantId", "subjectId", "count", "nested"], prefix: "session." },
  );
  expect(attrs).toEqual({
    "session.tenantId": "t1",
    "session.subjectId": "s1",
    "session.count": 3,
  });
});

test("invocationContextAttributes uses recommended keys by default", () => {
  const mapper = invocationContextAttributes();
  expect(mapper({ traceId: "tr-1", tenantId: "t1", extra: "ignored" })).toEqual({
    "invocation.traceId": "tr-1",
    "invocation.tenantId": "t1",
  });
});

test("sessionContextAttributes maps merged SessionContext", () => {
  const mapper = sessionContextAttributes({ allowlist: ["messageId"] });
  const attrs = mapper({
    agent: { agentId: "a1" } as never,
    input: {},
    context: { messageId: "msg-1", tenantId: "t1" },
  });
  expect(attrs).toEqual({ "session.messageId": "msg-1" });
});

test("capabilityLinkAttributes includes enabled tool names", () => {
  const mapper = capabilityLinkAttributes({ hashPrefixLength: 8 });
  const attrs = mapper({
    agentId: "a1",
    agentName: "demo",
    staticHash: "static",
    runtimeHash: "runtimehash123",
    invocationHash: "invocationhash456",
    toolRefs: [
      { toolKey: "search", toolHash: "h1" },
      { toolKey: "summarize", toolHash: "h2" },
    ],
  });
  expect(attrs["agent.enabled_tools"]).toBe("search,summarize");
  expect(attrs["agent.runtime_hash_short"]).toBe("runtimeh");
  expect(attrs["agent.invocation_hash_short"]).toBe("invocati");
});
