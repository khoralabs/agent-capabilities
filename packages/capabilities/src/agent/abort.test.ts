import { describe, expect, test } from "bun:test";
import {
  AgentSessionAbortedError,
  isAgentSessionAbortedError,
  raceWithAbort,
  throwIfAborted,
} from "./abort.js";

describe("AgentSessionAbortedError", () => {
  test("isAgentSessionAbortedError identifies the error", () => {
    const err = new AgentSessionAbortedError();
    expect(err.name).toBe("AgentSessionAbortedError");
    expect(isAgentSessionAbortedError(err)).toBe(true);
    expect(isAgentSessionAbortedError(new Error("other"))).toBe(false);
  });

  test("captures signal reason", () => {
    const controller = new AbortController();
    controller.abort("user cancelled");
    expect(() => throwIfAborted(controller.signal)).toThrow(AgentSessionAbortedError);
    try {
      throwIfAborted(controller.signal);
    } catch (err) {
      expect(isAgentSessionAbortedError(err)).toBe(true);
      if (isAgentSessionAbortedError(err)) {
        expect(err.reason).toBe("user cancelled");
      }
    }
  });
});

describe("throwIfAborted", () => {
  test("no-op when signal is undefined or not aborted", () => {
    throwIfAborted(undefined);
    throwIfAborted(new AbortController().signal);
  });
});

describe("raceWithAbort", () => {
  test("resolves when promise completes before abort", async () => {
    const controller = new AbortController();
    await expect(raceWithAbort(Promise.resolve(42), controller.signal)).resolves.toBe(42);
  });

  test("rejects when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(raceWithAbort(Promise.resolve(42), controller.signal)).rejects.toBeInstanceOf(
      AgentSessionAbortedError,
    );
  });

  test("rejects when signal aborts mid-flight", async () => {
    const controller = new AbortController();
    const pending = new Promise<number>((resolve) => {
      setTimeout(() => resolve(1), 50);
    });
    setTimeout(() => controller.abort(), 5);
    await expect(raceWithAbort(pending, controller.signal)).rejects.toBeInstanceOf(
      AgentSessionAbortedError,
    );
  });

  test("passes through without signal", async () => {
    await expect(raceWithAbort(Promise.resolve("ok"))).resolves.toBe("ok");
  });
});
