import type { PolicyExecuteBinding, SharedPolicy } from "./types.js";

export type PolicyOptions = {
  /**
   * `snapshot` — reuse evaluation cache at execute when `resolvedPolicies` / `policyResults` are passed.
   * `live` — re-run on every execute (default).
   */
  executeBinding?: PolicyExecuteBinding;
};

export function policy<Env>(
  id: string,
  evaluate: (env: Env) => Promise<boolean>,
  options?: PolicyOptions,
): SharedPolicy {
  return {
    id,
    evaluate: (env) => evaluate(env as Env),
    executeBinding: options?.executeBinding,
  };
}
