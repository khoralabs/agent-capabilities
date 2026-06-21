/** Thrown when an agent session is cancelled via {@link AbortSignal}. */
export class AgentSessionAbortedError extends Error {
  readonly reason: unknown;

  constructor(message = "Agent session aborted", reason?: unknown) {
    super(message);
    this.name = "AgentSessionAbortedError";
    this.reason = reason;
  }
}

export function isAgentSessionAbortedError(err: unknown): err is AgentSessionAbortedError {
  return err instanceof AgentSessionAbortedError;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AgentSessionAbortedError(undefined, signal.reason);
  }
}

/**
 * Runs {@link promise} and rejects with {@link AgentSessionAbortedError} when {@link signal} aborts.
 * Cleans up the abort listener when the promise settles.
 */
export function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(new AgentSessionAbortedError(undefined, signal.reason));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new AgentSessionAbortedError(undefined, signal.reason));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}
