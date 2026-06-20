import type { ToolPayloadTracing } from "./types.js";

function safeStringify(value: unknown, maxLength: number): string | undefined {
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return undefined;
    return s.length > maxLength ? `${s.slice(0, maxLength)}…` : s;
  } catch {
    return undefined;
  }
}

export function serializePayload(value: unknown, options: ToolPayloadTracing): string | undefined {
  const redacted = options.redact ? options.redact(value, "") : value;
  return safeStringify(redacted, options.maxStringLength ?? 1024);
}

export async function hashPayload(
  value: unknown,
  options: ToolPayloadTracing,
): Promise<string | undefined> {
  const json = serializePayload(value, options);
  if (json === undefined) return undefined;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function toolPayloadAttributes(
  event: { input: unknown; output?: unknown; ok: boolean },
  options: ToolPayloadTracing,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const inputMode = options.includeInput;
  const outputMode = options.includeOutput;

  if (inputMode === true) {
    const s = serializePayload(event.input, options);
    if (s !== undefined) out["tool.input"] = s;
  } else if (inputMode === "hash-only") {
    const h = await hashPayload(event.input, options);
    if (h !== undefined) out["tool.input_hash"] = h;
  }

  if (event.ok && outputMode === true) {
    const s = serializePayload(event.output, options);
    if (s !== undefined) out["tool.output"] = s;
  } else if (event.ok && outputMode === "hash-only") {
    const h = await hashPayload(event.output, options);
    if (h !== undefined) out["tool.output_hash"] = h;
  }

  return out;
}
