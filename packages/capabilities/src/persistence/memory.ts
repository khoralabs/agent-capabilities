import { newLinkId, newRegistrationId, newSnapshotId, newTransitionId } from "./ids.js";
import type { AgentCapabilitiesPersistence } from "./interface.js";
import type {
  AffordanceSnapshotEnvelopeRow,
  CapabilityLinkRow,
  CapabilityTransitionRow,
  RegisteredAgentRegistrationRow,
  RuntimeSnapshotRow,
} from "./types.js";

/**
 * In-memory {@link AgentCapabilitiesPersistence} (`:memory:`) for dev, tests, and as the default
 * backend for {@link createAgentRegistry}.
 */
export function createMemoryAgentCapabilitiesPersistence(): AgentCapabilitiesPersistence {
  const registrationsById = new Map<string, RegisteredAgentRegistrationRow>();
  const latestRegistrationByAgent = new Map<string, RegisteredAgentRegistrationRow>();
  const registrationKeyIndex = new Map<string, string>();

  const linksById = new Map<string, CapabilityLinkRow>();
  const latestLinkBySession = new Map<string, CapabilityLinkRow>();
  const linksByAgent = new Map<string, CapabilityLinkRow[]>();

  const runtimeSnapshotsById = new Map<string, RuntimeSnapshotRow>();
  const envelopeSnapshotsById = new Map<string, AffordanceSnapshotEnvelopeRow>();
  const transitionsById = new Map<string, CapabilityTransitionRow>();

  function registrationDedupeKey(agentId: string, staticHash: string): string {
    return `${agentId}\0${staticHash}`;
  }

  return {
    async upsertRegisteredAgentSnapshot(input) {
      const { row } = input;
      const key = registrationDedupeKey(row.agentId, row.staticHash);
      const existingId = registrationKeyIndex.get(key);
      if (existingId !== undefined) {
        const existing = registrationsById.get(existingId);
        if (existing) {
          latestRegistrationByAgent.set(row.agentId, existing);
          return { registrationId: existing.registrationId };
        }
      }
      const registrationId = row.registrationId || newRegistrationId();
      const stored: RegisteredAgentRegistrationRow = {
        ...row,
        registrationId,
      };
      registrationsById.set(registrationId, stored);
      registrationKeyIndex.set(key, registrationId);
      latestRegistrationByAgent.set(row.agentId, stored);
      return { registrationId };
    },

    async getLatestRegisteredAgentForAgent(input) {
      const row = latestRegistrationByAgent.get(input.agentId);
      return row ? { row: { ...row, staticProps: { ...row.staticProps } } } : {};
    },

    async recordSessionCapabilityLink(input) {
      const linkId = input.link.linkId || newLinkId();
      const stored: CapabilityLinkRow = {
        ...input.link,
        linkId,
        toolRefs: input.link.toolRefs ? [...input.link.toolRefs] : undefined,
        metadata: input.link.metadata ? { ...input.link.metadata } : undefined,
      };
      linksById.set(linkId, stored);
      latestLinkBySession.set(stored.sessionId, stored);
      const list = linksByAgent.get(stored.agentId) ?? [];
      list.push(stored);
      linksByAgent.set(stored.agentId, list);
      return { linkId };
    },

    async getLatestCapabilityLinkForSession(input) {
      const link = latestLinkBySession.get(input.sessionId);
      return link
        ? {
            link: {
              ...link,
              toolRefs: link.toolRefs ? [...link.toolRefs] : undefined,
              metadata: link.metadata ? { ...link.metadata } : undefined,
            },
          }
        : {};
    },

    async listCapabilityLinksForAgent(input) {
      const all = linksByAgent.get(input.agentId) ?? [];
      const cursor = input.query?.cursor;
      const offset = typeof cursor === "number" ? cursor : 0;
      const pageSize = 50;
      const slice = all.slice(offset, offset + pageSize);
      const nextOffset = offset + slice.length;
      const nextPage = nextOffset < all.length ? { cursor: nextOffset } : undefined;
      return {
        links: slice.map((l) => ({
          ...l,
          toolRefs: l.toolRefs ? [...l.toolRefs] : undefined,
          metadata: l.metadata ? { ...l.metadata } : undefined,
        })),
        nextPage,
      };
    },

    async recordRuntimeToolRefSnapshot(input) {
      const snapshotId = input.row.snapshotId || newSnapshotId();
      const stored: RuntimeSnapshotRow = {
        ...input.row,
        snapshotId,
        toolRefs: [...input.row.toolRefs],
        metadata: input.row.metadata ? { ...input.row.metadata } : undefined,
      };
      runtimeSnapshotsById.set(snapshotId, stored);
      return { snapshotId };
    },

    async recordAffordanceSnapshotEnvelope(input) {
      const snapshotId = input.row.snapshotId || newSnapshotId();
      const stored: AffordanceSnapshotEnvelopeRow = {
        ...input.row,
        snapshotId,
        envelope: structuredClone(input.row.envelope),
        metadata: input.row.metadata ? { ...input.row.metadata } : undefined,
      };
      envelopeSnapshotsById.set(snapshotId, stored);
      return { snapshotId };
    },

    async getAffordanceSnapshotEnvelope(input) {
      const row = envelopeSnapshotsById.get(input.snapshotId);
      return row
        ? {
            row: {
              ...row,
              envelope: structuredClone(row.envelope),
              metadata: row.metadata ? { ...row.metadata } : undefined,
            },
          }
        : {};
    },

    async recordCapabilityTransition(input) {
      const transitionId = input.row.transitionId || newTransitionId();
      const stored: CapabilityTransitionRow = {
        ...input.row,
        transitionId,
        metadata: input.row.metadata ? { ...input.row.metadata } : undefined,
      };
      transitionsById.set(transitionId, stored);
      return { transitionId };
    },
  };
}
