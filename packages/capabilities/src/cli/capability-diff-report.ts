import {
  diffAffordancePolicyIds,
  diffCapabilityLinks,
  diffPolicyEvaluationSnapshots,
  diffToolRefs,
  explainCapabilityLinkRelationship,
  formatHashShort,
} from "../agent/capability-diff.js";
import type { DiffSources } from "./parse-diff-input.js";

export type CapabilityDiffReportLabels = {
  first?: string;
  second?: string;
};

export type CapabilityDiffJsonReport = {
  summary: string;
  labels: { first: string; second: string };
  link: ReturnType<typeof diffCapabilityLinks>;
  tools: ReturnType<typeof diffToolRefs>;
  policies: {
    note?: string;
    results?: ReturnType<typeof diffPolicyEvaluationSnapshots>;
    affordancePolicyIds?: ReturnType<typeof diffAffordancePolicyIds>;
  };
};

function formatHashField(value: string | undefined): string {
  if (value === undefined) {
    return "(none)";
  }
  return formatHashShort(value);
}

function buildPoliciesSection(
  first: DiffSources,
  second: DiffSources,
  labels: { first: string; second: string },
): { lines: string[]; json: CapabilityDiffJsonReport["policies"] } {
  const lines: string[] = [];
  const json: CapabilityDiffJsonReport["policies"] = {};

  const hasPolicyA = first.policy !== undefined;
  const hasPolicyB = second.policy !== undefined;
  const hasAffA = first.affordances !== undefined;
  const hasAffB = second.affordances !== undefined;

  if (!hasPolicyA && !hasPolicyB && !hasAffA && !hasAffB) {
    return { lines, json };
  }

  lines.push("Policies:");

  if ((hasPolicyA || hasAffA) !== (hasPolicyB || hasAffB)) {
    const missing = !hasPolicyA && !hasAffA ? labels.first : labels.second;
    const note = `Policy/affordance data only on one side (${missing} has no policy closure); link-level comparison only for that side.`;
    lines.push(`  ${note}`);
    json.note = note;
  }

  if (hasPolicyA && hasPolicyB && first.policy && second.policy) {
    const results = diffPolicyEvaluationSnapshots(first.policy, second.policy);
    json.results = results;
    if (
      results.onlyInFirst.length === 0 &&
      results.onlyInSecond.length === 0 &&
      results.valueChanged.length === 0
    ) {
      lines.push("  Policy results: unchanged.");
    } else {
      for (const { policyId, allowed } of results.onlyInFirst) {
        lines.push(`  Policy ${policyId}: only in ${labels.first} (allowed=${allowed})`);
      }
      for (const { policyId, allowed } of results.onlyInSecond) {
        lines.push(`  Policy ${policyId}: only in ${labels.second} (allowed=${allowed})`);
      }
      for (const { policyId, first: f, second: s } of results.valueChanged) {
        lines.push(`  Policy ${policyId}: ${labels.first}=${f} → ${labels.second}=${s}`);
      }
    }
  }

  if (hasAffA && hasAffB && first.affordances && second.affordances) {
    const affordancePolicyIds = diffAffordancePolicyIds(
      first.affordances.tools,
      second.affordances.tools,
    );
    json.affordancePolicyIds = affordancePolicyIds;
    for (const name of affordancePolicyIds.onlyInFirst) {
      lines.push(`  Tool ${name}: only in ${labels.first} affordances`);
    }
    for (const name of affordancePolicyIds.onlyInSecond) {
      lines.push(`  Tool ${name}: only in ${labels.second} affordances`);
    }
    for (const { toolName, added, removed } of affordancePolicyIds.changed) {
      const parts: string[] = [];
      if (removed.length > 0) {
        parts.push(`removed [${removed.join(", ")}]`);
      }
      if (added.length > 0) {
        parts.push(`added [${added.join(", ")}]`);
      }
      lines.push(`  Tool ${toolName} policyIds: ${parts.join("; ")}`);
    }
    if (
      affordancePolicyIds.onlyInFirst.length === 0 &&
      affordancePolicyIds.onlyInSecond.length === 0 &&
      affordancePolicyIds.changed.length === 0 &&
      !json.results
    ) {
      lines.push("  Affordance policyIds: unchanged.");
    }
  }

  return { lines, json };
}

export function buildCapabilityDiffJsonReport(args: {
  first: DiffSources;
  second: DiffSources;
  labels?: CapabilityDiffReportLabels;
}): CapabilityDiffJsonReport {
  const firstLabel = args.labels?.first ?? "first";
  const secondLabel = args.labels?.second ?? "second";
  const linkA = args.first.link;
  const linkB = args.second.link;
  const { json: policies } = buildPoliciesSection(args.first, args.second, {
    first: firstLabel,
    second: secondLabel,
  });
  return {
    summary: explainCapabilityLinkRelationship(linkA, linkB),
    labels: { first: firstLabel, second: secondLabel },
    link: diffCapabilityLinks(linkA, linkB),
    tools: diffToolRefs(linkA.toolRefs, linkB.toolRefs),
    policies,
  };
}

export function formatCapabilityDiffReport(args: {
  first: DiffSources;
  second: DiffSources;
  labels?: CapabilityDiffReportLabels;
}): string {
  const firstLabel = args.labels?.first ?? "first";
  const secondLabel = args.labels?.second ?? "second";
  const linkA = args.first.link;
  const linkB = args.second.link;
  const lines: string[] = [];

  lines.push("Summary:");
  lines.push(`  ${explainCapabilityLinkRelationship(linkA, linkB)}`);
  lines.push(`  (${firstLabel} vs ${secondLabel})`);

  const linkDiff = diffCapabilityLinks(linkA, linkB);
  lines.push("Link fields:");
  if (linkDiff.changed.length === 0) {
    lines.push("  Unchanged.");
  } else {
    for (const { field, first, second } of linkDiff.changed) {
      lines.push(`  ${field}: ${formatHashField(first)} → ${formatHashField(second)}`);
    }
  }

  const toolDiff = diffToolRefs(linkA.toolRefs, linkB.toolRefs);
  lines.push("Tools:");
  const toolQuiet =
    toolDiff.onlyInFirst.length === 0 &&
    toolDiff.onlyInSecond.length === 0 &&
    toolDiff.hashChanged.length === 0;
  if (toolQuiet) {
    lines.push("  Unchanged.");
  } else {
    for (const { toolKey, toolHash } of toolDiff.onlyInFirst) {
      lines.push(`  Removed ${toolKey} (hash ${formatHashShort(toolHash)})`);
    }
    for (const { toolKey, toolHash } of toolDiff.onlyInSecond) {
      lines.push(`  Added ${toolKey} (hash ${formatHashShort(toolHash)})`);
    }
    for (const { toolKey, firstHash, secondHash } of toolDiff.hashChanged) {
      lines.push(
        `  ${toolKey}: hash changed ${formatHashShort(firstHash)} → ${formatHashShort(secondHash)} (static definition drift for that tool key)`,
      );
    }
  }

  const { lines: policyLines } = buildPoliciesSection(args.first, args.second, {
    first: firstLabel,
    second: secondLabel,
  });
  lines.push(...policyLines);

  return `${lines.join("\n")}\n`;
}
