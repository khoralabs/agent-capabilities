#!/usr/bin/env bun
/**
 * Validate a staged release directory: manifest, dist layout, public exports in source dist.
 * usage: verify-staged-release.ts <capabilities-ai-sdk|capabilities-otel>
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { isReleasePackage } from "./stage-agent-capabilities-release.js";

const packageName = process.argv[2];
if (
  !packageName ||
  !isReleasePackage(packageName) ||
  packageName === "capabilities" ||
  packageName === "capabilities-spec"
) {
  console.error("usage: verify-staged-release.ts <capabilities-ai-sdk|capabilities-otel>");
  process.exit(1);
}

const workspaceRoot = path.resolve(import.meta.dir, "..");
const releaseDir = path.join(workspaceRoot, "release", packageName);
const pkgDir = path.join(workspaceRoot, "packages", packageName);
const pkgJsonPath = path.join(releaseDir, "package.json");
const stagedEntry = path.join(releaseDir, "dist/index.js");
const sourceEntry = path.join(pkgDir, "dist/index.js");

for (const file of [
  pkgJsonPath,
  stagedEntry,
  path.join(releaseDir, "dist/index.d.ts"),
  path.join(releaseDir, "README.md"),
  path.join(releaseDir, "LICENSE"),
]) {
  if (!existsSync(file)) {
    console.error(`missing: ${file}`);
    process.exit(1);
  }
}

const pkg = JSON.parse(await Bun.file(pkgJsonPath).text()) as {
  name: string;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  exports?: { ".": { import?: string; types?: string } };
};

const requiredPeers = ["@khoralabs/agent-capabilities"];
if (packageName === "capabilities-ai-sdk") requiredPeers.push("ai");
if (packageName === "capabilities-otel") {
  requiredPeers.push("@opentelemetry/api", "pino");
}

for (const peer of requiredPeers) {
  if (!pkg.peerDependencies?.[peer]) {
    console.error(`missing peerDependency: ${peer}`);
    process.exit(1);
  }
  if (!pkg.dependencies?.[peer]) {
    console.error(`missing dependency (npm install): ${peer}`);
    process.exit(1);
  }
}

if (pkg.exports?.["."]?.import !== "./dist/index.js") {
  console.error('exports["."].import must be "./dist/index.js"');
  process.exit(1);
}

if (pkg.exports?.["."]?.types !== "./dist/index.d.ts") {
  console.error('exports["."].types must be "./dist/index.d.ts"');
  process.exit(1);
}

const mod = await import(sourceEntry);
const expectedExports =
  packageName === "capabilities-ai-sdk"
    ? ["toolSpecToAiTool", "toolMapToAiTools"]
    : ["createAgentTelemetry", "toSpanAttributes", "invocationContextAttributes"];

for (const name of expectedExports) {
  if (typeof (mod as Record<string, unknown>)[name] !== "function") {
    console.error(`missing export in dist: ${name}`);
    process.exit(1);
  }
}

const stagedJs = await Bun.file(stagedEntry).text();
if (stagedJs.includes("../capabilities/") || stagedJs.includes(".ts")) {
  console.error("staged dist must not reference monorepo source paths");
  process.exit(1);
}

console.log(`ok: ${pkg.name} staged release is consumer-ready`);
