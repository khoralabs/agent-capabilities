import { describe, expect, test } from "bun:test";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { tool } from "../tool/tool.js";
import { createToolRegistry } from "../tool/tool-registry.js";
import { hashToolComposableStatic } from "../tool/tool-static.js";
import { toolkit } from "../toolkit/toolkit.js";
import { AgentSessionAbortedError } from "./abort.js";
import { createAgentRegistry } from "./agent-registry.js";
import { createRegisteredAgent } from "./registered-agent.js";

const schema: StandardSchemaV1<{ n: number }> = {
  "~standard": {
    version: 1,
    vendor: "test",
    types: { input: {} as { n: number }, output: {} as { n: number } },
    validate: (v) =>
      typeof v === "object" && v !== null && "n" in v && typeof (v as { n: unknown }).n === "number"
        ? { value: v as { n: number } }
        : { issues: [{ message: "bad" }] },
  },
};

describe("createToolRegistry", () => {
  test("get and getByHash after register", async () => {
    const reg = createToolRegistry();
    const t = tool({
      name: "add",
      inputSchema: schema,
      handler: async () => 0,
    });
    const hash = await reg.register("add", t);
    expect(reg.get("add")?.hash).toBe(hash);
    expect(reg.getByHash(hash)?.key).toBe("add");
    expect(reg.has("add")).toBe(true);
    expect(reg.listKeys()).toContain("add");
  });

  test("last register wins for same key", async () => {
    const reg = createToolRegistry();
    const t1 = tool({
      name: "t",
      inputSchema: schema,
      handler: async () => 0,
    });
    await reg.register("t", t1);
    const t2 = tool({
      name: "t",
      description: "v2",
      inputSchema: schema,
      handler: async () => 0,
    });
    await reg.register("t", t2);
    expect(await reg.get("t")?.composable.computeStaticHash()).toBe(await t2.computeStaticHash());
  });

  test("getByHash last write wins for same hash", async () => {
    const reg = createToolRegistry();
    const t = tool({
      name: "x",
      inputSchema: schema,
      handler: async () => 0,
    });
    const hash = await reg.register("a", t);
    await reg.register("b", t);
    expect(reg.getByHash(hash)?.key).toBe("b");
  });
});

describe("createAgentRegistry", () => {
  test("round-trip and staticHash", async () => {
    const reg = createAgentRegistry();
    const graph = tool({
      name: "n",
      inputSchema: schema,
      handler: async () => 0,
    });
    const { staticHash, agent } = await createRegisteredAgent({
      agentId: "a1",
      name: "Agent",
      instructions: ["static line"],
      rootComposable: graph,
    });
    const { staticHash: got } = await reg.register(agent);
    const entry = reg.get("a1");
    expect(got).toBe(staticHash);
    const persisted = await reg.persistence.getLatestRegisteredAgentForAgent({ agentId: "a1" });
    expect(persisted.row?.staticHash).toBe(staticHash);
    expect(persisted.row?.agentId).toBe("a1");
    expect(entry?.agent.staticHash).toBe(staticHash);
    expect(entry?.agent.agentId).toBe("a1");
    expect(entry?.agent.staticProps.kind).toBe("registered-agent");
    expect(entry?.agent.staticProps.instructions).toEqual(["static line"]);
    expect(entry?.agent.rootComposable).toBe(graph);
  });

  test("last register wins for same agentId", async () => {
    const reg = createAgentRegistry();
    const g1 = tool({ name: "a", inputSchema: schema, handler: async () => 0 });
    const g2 = tool({ name: "b", inputSchema: schema, handler: async () => 0 });
    await reg.register(
      (
        await createRegisteredAgent({
          agentId: "same",
          name: "One",
          instructions: [],
          rootComposable: g1,
        })
      ).agent,
    );
    await reg.register(
      (
        await createRegisteredAgent({
          agentId: "same",
          name: "Two",
          instructions: [],
          rootComposable: g2,
        })
      ).agent,
    );
    expect(reg.get("same")?.agent.name).toBe("Two");
  });

  test("createSession composes hooks in registry-session-builder order", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "hooks",
      name: "Hooks",
      instructions: [],
      rootComposable: graph,
    });
    const seen: string[] = [];
    await reg.register(agent, {
      hooks: {
        onStart: () => {
          seen.push("registry-start");
        },
      },
      run: async () => 7,
    });
    const session = reg.createSession("hooks", {
      hooks: {
        onStart: () => {
          seen.push("session-start");
        },
      },
    });
    session.onStart(() => {
      seen.push("builder-start");
    });
    const out = await session.start<void, number>(undefined);
    expect(out).toBe(7);
    expect(seen).toEqual(["registry-start", "session-start", "builder-start"]);
  });

  test("context precedence is session over registry over agent static", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "ctx",
      name: "Ctx",
      instructions: [],
      context: { shared: "agent", onlyAgent: true },
      rootComposable: graph,
    });
    await reg.register(agent, {
      ctx: { shared: "registry", onlyRegistry: true },
      run: async ({ context }) => context,
    });
    const out = await reg
      .createSession("ctx", { ctx: { shared: "session", onlySession: true } })
      .start<void, Record<string, unknown>>(undefined);
    expect(out).toEqual({
      shared: "session",
      onlyAgent: true,
      onlyRegistry: true,
      onlySession: true,
    });
  });

  test("onError runs on runner failure and onAfterRun does not", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "err",
      name: "Err",
      instructions: [],
      rootComposable: graph,
    });
    const seen: string[] = [];
    await reg.register(agent, {
      hooks: {
        onStart: () => {
          seen.push("onStart");
        },
        onBeforeContext: () => {
          seen.push("onBeforeContext");
        },
        onAfterContext: () => {
          seen.push("onAfterContext");
        },
        onBeforeRun: () => {
          seen.push("onBeforeRun");
        },
        onAfterRun: () => {
          seen.push("onAfterRun");
        },
        onError: () => {
          seen.push("onError");
        },
      },
      run: async () => {
        throw new Error("runner failed");
      },
    });
    const session = reg.createSession("err");
    await expect(session.start(undefined)).rejects.toThrow("runner failed");
    expect(seen).toEqual([
      "onStart",
      "onBeforeContext",
      "onAfterContext",
      "onBeforeRun",
      "onError",
    ]);
    expect(seen).not.toContain("onAfterRun");
  });

  test("context resolver runs at start with merged input", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "resolver",
      name: "Resolver",
      instructions: [],
      rootComposable: graph,
    });
    await reg.register(agent, {
      ctx: ({ input }) => ({ fromRegistryResolver: Number(input) + 1 }),
      run: async ({ context }) => context,
    });
    const out = await reg
      .createSession("resolver", {
        ctx: ({ context }) => ({ fromSessionResolver: Number(context.fromRegistryResolver) + 1 }),
      })
      .start<number, Record<string, unknown>>(1);
    expect(out).toEqual({
      fromRegistryResolver: 2,
      fromSessionResolver: 3,
    });
  });

  test("pre-aborted signal throws before runner and skips onAfterRun", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "abort-pre",
      name: "AbortPre",
      instructions: [],
      rootComposable: graph,
    });
    const seen: string[] = [];
    await reg.register(agent, {
      hooks: {
        onStart: () => {
          seen.push("onStart");
        },
        onAfterRun: () => {
          seen.push("onAfterRun");
        },
        onError: () => {
          seen.push("onError");
        },
      },
      run: async () => {
        seen.push("run");
        return 1;
      },
    });
    const controller = new AbortController();
    controller.abort();
    const session = reg.createSession("abort-pre", { signal: controller.signal });
    await expect(session.start(undefined)).rejects.toBeInstanceOf(AgentSessionAbortedError);
    expect(seen).toEqual(["onError"]);
    expect(seen).not.toContain("run");
    expect(seen).not.toContain("onAfterRun");
  });

  test("signal injects abortSignal into session context", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "abort-ctx",
      name: "AbortCtx",
      instructions: [],
      rootComposable: graph,
    });
    const controller = new AbortController();
    await reg.register(agent, {
      run: async ({ context }) => context,
    });
    const out = await reg
      .createSession("abort-ctx", { signal: controller.signal })
      .start<void, { abortSignal?: AbortSignal }>(undefined);
    expect(out.abortSignal).toBe(controller.signal);
  });

  test("mid-run abort rejects with AgentSessionAbortedError", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "abort-mid",
      name: "AbortMid",
      instructions: [],
      rootComposable: graph,
    });
    const controller = new AbortController();
    await reg.register(agent, {
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return "done";
      },
    });
    const session = reg.createSession("abort-mid", { signal: controller.signal });
    const pending = session.start(undefined);
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toBeInstanceOf(AgentSessionAbortedError);
  });

  test("start options signal overrides session signal", async () => {
    const reg = createAgentRegistry();
    const graph = tool({ name: "n", inputSchema: schema, handler: async () => 0 });
    const { agent } = await createRegisteredAgent({
      agentId: "abort-override",
      name: "AbortOverride",
      instructions: [],
      rootComposable: graph,
    });
    const sessionSignal = new AbortController().signal;
    const runSignal = new AbortController().signal;
    await reg.register(agent, {
      run: async ({ context }) => (context as { abortSignal?: AbortSignal }).abortSignal,
    });
    const out = await reg
      .createSession("abort-override", { signal: sessionSignal })
      .start<void, AbortSignal | undefined>(undefined, { signal: runSignal });
    expect(out).toBe(runSignal);
  });
});

describe("hashToolComposableStatic", () => {
  test("hashes tool composable; throws for toolkit", async () => {
    const t = tool({
      name: "x",
      inputSchema: schema,
      handler: async () => 0,
    });
    const tk = toolkit([t], { name: "root" });
    expect(hashToolComposableStatic(t)).resolves.toBeDefined();
    expect(hashToolComposableStatic(tk as never)).rejects.toThrow(
      'expected composable with kind "tool"',
    );
  });
});
