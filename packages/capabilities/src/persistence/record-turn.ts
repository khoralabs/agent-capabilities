import type { CapabilityLink } from "../agent/capability-link.js";
import type { AgentSnapshotEnvelope } from "../snapshot/types.js";
import type { AgentCapabilitiesPersistence } from "./interface.js";
import { capabilityLinkToRow, envelopeToRow } from "./row-builders.js";
import type { CapabilitiesOpContext } from "./types.js";

export type RecordTurnAttributionArgs = {
  op: CapabilitiesOpContext;
  sessionId: string;
  link: CapabilityLink;
  envelope?: AgentSnapshotEnvelope;
  linkMetadata?: Record<string, unknown>;
  envelopeMetadata?: Record<string, unknown>;
};

export type RecordTurnAttributionResult = {
  linkId: string;
  envelopeSnapshotId?: string;
};

/**
 * Persist capability link (and optional envelope) for one turn via {@link AgentCapabilitiesPersistence}.
 * Typical use: `onAfterRun` after {@link captureAgentSnapshotEnvelope}.
 */
export async function recordTurnAttribution(
  persistence: AgentCapabilitiesPersistence,
  args: RecordTurnAttributionArgs,
): Promise<RecordTurnAttributionResult> {
  const { linkId } = await persistence.recordSessionCapabilityLink({
    op: args.op,
    link: capabilityLinkToRow(args.link, args.sessionId, args.op, {
      metadata: args.linkMetadata,
    }),
  });

  let envelopeSnapshotId: string | undefined;
  if (args.envelope !== undefined) {
    const out = await persistence.recordAffordanceSnapshotEnvelope({
      op: args.op,
      row: envelopeToRow(args.envelope, args.sessionId, args.op, {
        metadata: args.envelopeMetadata,
      }),
    });
    envelopeSnapshotId = out.snapshotId;
  }

  return { linkId, envelopeSnapshotId };
}
