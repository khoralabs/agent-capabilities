import type { AgentCapabilitiesPersistence } from "../persistence/interface.js";
import { createMemoryAgentCapabilitiesPersistence } from "../persistence/memory.js";
import { defaultOpContext, registeredAgentToRegistrationRow } from "../persistence/row-builders.js";
import type { CapabilitiesOpContext } from "../persistence/types.js";
import type { RegisteredAgent } from "./types.js";

type MaybePromise<T> = T | Promise<T>;

export type SessionContext = Record<string, unknown>;

export type SessionContextResolverArgs<Input = unknown> = {
  agent: RegisteredAgent;
  input: Input;
  context: SessionContext;
};

export type SessionContextInput<Input = unknown> =
  | SessionContext
  | ((args: SessionContextResolverArgs<Input>) => MaybePromise<SessionContext | undefined>);

export type AgentSessionHooks<
  Input = unknown,
  Output = unknown,
  Context extends SessionContext = SessionContext,
> = {
  onStart?: (args: { agent: RegisteredAgent; input: Input }) => MaybePromise<void>;
  onAfterAgent?: (args: { agent: RegisteredAgent; input: Input }) => MaybePromise<void>;
  onAfterContext?: (args: {
    agent: RegisteredAgent;
    input: Input;
    context: Context;
  }) => MaybePromise<void>;
  onBeforeRun?: (args: {
    agent: RegisteredAgent;
    input: Input;
    context: Context;
  }) => MaybePromise<void>;
  onAfterRun?: (args: {
    agent: RegisteredAgent;
    input: Input;
    context: Context;
    output: Output;
  }) => MaybePromise<void>;
  onError?: (args: {
    agent: RegisteredAgent;
    input: Input;
    context: Context;
    error: unknown;
  }) => MaybePromise<void>;
};

export type SessionRunner<
  Input = unknown,
  Output = unknown,
  Context extends SessionContext = SessionContext,
> = (args: { agent: RegisteredAgent; input: Input; context: Context }) => MaybePromise<Output>;

/**
 * Runner type for {@link RegisterAgentOptions.run} / {@link RegisteredAgentEntry.run}.
 * Uses a method-style key so `input` is checked **bivariantly**; then a concrete
 * `SessionRunner<SpecificInput, SpecificOutput>` assigns without casts while `start()` still passes `unknown` through at runtime.
 */
export type RegisteredSessionRunner = {
  bivarianceHack(args: {
    agent: RegisteredAgent;
    input: unknown;
    context: SessionContext;
  }): MaybePromise<unknown>;
}["bivarianceHack"];

export type RegisterAgentOptions<
  Input = unknown,
  Output = unknown,
  Context extends SessionContext = SessionContext,
> = {
  hooks?: AgentSessionHooks<Input, Output, Context>;
  ctx?: SessionContextInput<Input> | SessionContextInput<Input>[];
  run?: RegisteredSessionRunner;
};

export type CreateSessionOptions<
  Input = unknown,
  Output = unknown,
  Context extends SessionContext = SessionContext,
> = {
  hooks?: AgentSessionHooks<Input, Output, Context>;
  ctx?: SessionContextInput<Input> | SessionContextInput<Input>[];
  run?: RegisteredSessionRunner;
  /** Host session id for attribution persistence (e.g. with {@link recordTurnAttribution}). */
  sessionId?: string;
};

export type CreateAgentRegistryOptions = {
  /** Default: in-memory persistence (`:memory:`). */
  persistence?: AgentCapabilitiesPersistence;
  /** Op context for persistence writes on {@link AgentRegistry.register}. */
  opContext?: () => CapabilitiesOpContext;
};

/** Hooks are widened for heterogeneous storage; invocation stays `unknown` at runtime (see `runStage`). */
export type RegisteredAgentEntry = {
  agent: RegisteredAgent;
  hooks?: AgentSessionHooks<unknown, unknown, SessionContext>;
  ctx?: SessionContextInput[];
  run?: RegisteredSessionRunner;
};

export type AgentSession = {
  readonly agentId: string;
  readonly sessionId?: string;
  onStart: (hook: NonNullable<AgentSessionHooks["onStart"]>) => AgentSession;
  onAfterAgent: (hook: NonNullable<AgentSessionHooks["onAfterAgent"]>) => AgentSession;
  onAfterContext: (hook: NonNullable<AgentSessionHooks["onAfterContext"]>) => AgentSession;
  onBeforeRun: (hook: NonNullable<AgentSessionHooks["onBeforeRun"]>) => AgentSession;
  onAfterRun: (hook: NonNullable<AgentSessionHooks["onAfterRun"]>) => AgentSession;
  onError: (hook: NonNullable<AgentSessionHooks["onError"]>) => AgentSession;
  start: <Input = unknown, Output = unknown>(input: Input) => Promise<Output>;
};

export type AgentRegistry = {
  /** Smithy-aligned storage backend (default `:memory:`). */
  readonly persistence: AgentCapabilitiesPersistence;
  register: <Input = unknown, Output = unknown, Context extends SessionContext = SessionContext>(
    agent: RegisteredAgent,
    options?: RegisterAgentOptions<Input, Output, Context>,
  ) => Promise<{ staticHash: string }>;
  createSession: <
    Input = unknown,
    Output = unknown,
    Context extends SessionContext = SessionContext,
  >(
    agentId: string,
    options?: CreateSessionOptions<Input, Output, Context>,
  ) => AgentSession;
  get: (agentId: string) => RegisteredAgentEntry | undefined;
  has: (agentId: string) => boolean;
  listKeys: () => string[];
  entries: () => IterableIterator<[string, RegisteredAgentEntry]>;
};

function toArray<T>(value?: T | T[]): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeContext(base: SessionContext, extra?: SessionContext): SessionContext {
  return extra ? { ...base, ...extra } : base;
}

/**
 * Session host with default `:memory:` {@link AgentCapabilitiesPersistence}.
 * Orchestration (hooks, `run`, live composable) lives in a process-local overlay; persistence
 * stores registration rows and attribution. Production: pass your DB-backed persistence implementation.
 */
export function createAgentRegistry(options?: CreateAgentRegistryOptions): AgentRegistry {
  const persistence = options?.persistence ?? createMemoryAgentCapabilitiesPersistence();
  const opContext = options?.opContext ?? defaultOpContext;
  const overlay = new Map<string, RegisteredAgentEntry>();

  async function register<
    Input = unknown,
    Output = unknown,
    Context extends SessionContext = SessionContext,
  >(
    agent: RegisteredAgent,
    registerOptions: RegisterAgentOptions<Input, Output, Context> = {},
  ): Promise<{ staticHash: string }> {
    const op = opContext();
    await persistence.upsertRegisteredAgentSnapshot({
      op,
      row: registeredAgentToRegistrationRow(agent, op),
    });
    overlay.set(agent.agentId, {
      agent,
      hooks: registerOptions.hooks as RegisteredAgentEntry["hooks"],
      ctx: toArray(registerOptions.ctx) as RegisteredAgentEntry["ctx"],
      run: registerOptions.run,
    });
    return { staticHash: agent.staticHash };
  }

  function createSession<
    Input = unknown,
    Output = unknown,
    Context extends SessionContext = SessionContext,
  >(
    agentId: string,
    sessionOptions: CreateSessionOptions<Input, Output, Context> = {},
  ): AgentSession {
    const entry = overlay.get(agentId);
    if (!entry) {
      throw new Error(`agent not registered: ${agentId}`);
    }
    const registered = entry;
    const sessionHooks: AgentSessionHooks = {};
    const sessionCtx = toArray(sessionOptions.ctx);
    const sessionRun = sessionOptions.run;
    const sessionId = sessionOptions.sessionId;

    async function runStage(
      stage: keyof AgentSessionHooks,
      args:
        | { agent: RegisteredAgent; input: unknown }
        | { agent: RegisteredAgent; input: unknown; context: SessionContext }
        | {
            agent: RegisteredAgent;
            input: unknown;
            context: SessionContext;
            output: unknown;
          }
        | {
            agent: RegisteredAgent;
            input: unknown;
            context: SessionContext;
            error: unknown;
          },
    ): Promise<void> {
      const hooks = [
        registered.hooks?.[stage],
        sessionOptions.hooks?.[stage],
        sessionHooks[stage],
      ].filter(Boolean) as Array<(a: unknown) => MaybePromise<void>>;
      for (const hook of hooks) {
        await hook(args);
      }
    }

    async function resolveContext(input: unknown): Promise<SessionContext> {
      let merged: SessionContext = { ...(registered.agent.staticContext ?? {}) };
      const allCtx = [...(registered.ctx ?? []), ...sessionCtx];
      for (const piece of allCtx) {
        if (typeof piece === "function") {
          const resolved = await (
            piece as (args: SessionContextResolverArgs) => MaybePromise<SessionContext | undefined>
          )({
            agent: registered.agent,
            input,
            context: merged,
          });
          if (resolved) {
            merged = mergeContext(merged, resolved);
          }
        } else {
          merged = mergeContext(merged, piece);
        }
      }
      return merged;
    }

    const session: AgentSession = {
      agentId,
      sessionId,
      onStart(hook) {
        sessionHooks.onStart = hook;
        return session;
      },
      onAfterAgent(hook) {
        sessionHooks.onAfterAgent = hook;
        return session;
      },
      onAfterContext(hook) {
        sessionHooks.onAfterContext = hook;
        return session;
      },
      onBeforeRun(hook) {
        sessionHooks.onBeforeRun = hook;
        return session;
      },
      onAfterRun(hook) {
        sessionHooks.onAfterRun = hook;
        return session;
      },
      onError(hook) {
        sessionHooks.onError = hook;
        return session;
      },
      async start<Input = unknown, Output = unknown>(input: Input): Promise<Output> {
        const agent = registered.agent;
        await runStage("onStart", { agent, input });
        await runStage("onAfterAgent", { agent, input });
        const context = await resolveContext(input);
        await runStage("onAfterContext", { agent, input, context });
        await runStage("onBeforeRun", { agent, input, context });
        const runner = sessionRun ?? registered.run;
        if (!runner) {
          throw new Error(`no session runner configured for agent: ${agentId}`);
        }
        try {
          const output = (await runner({ agent, input, context })) as Output;
          await runStage("onAfterRun", { agent, input, context, output });
          return output;
        } catch (error) {
          await runStage("onError", { agent, input, context, error });
          throw error;
        }
      },
    };
    return session;
  }

  function get(agentId: string): RegisteredAgentEntry | undefined {
    return overlay.get(agentId);
  }

  function has(agentId: string): boolean {
    return overlay.has(agentId);
  }

  function listKeys(): string[] {
    return [...overlay.keys()];
  }

  function entries(): IterableIterator<[string, RegisteredAgentEntry]> {
    return overlay.entries();
  }

  return {
    persistence,
    register,
    createSession,
    get,
    has,
    listKeys,
    entries,
  };
}
