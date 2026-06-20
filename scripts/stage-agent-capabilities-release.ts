#!/usr/bin/env bun
/**
 * Stage a standalone npm package under release/<name>/ (outside Bun workspaces).
 * Publish from that directory.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

export const RELEASE_PACKAGES = [
  "capabilities",
  "capabilities-ai-sdk",
  "capabilities-otel",
  "capabilities-spec",
] as const;
export type ReleasePackage = (typeof RELEASE_PACKAGES)[number];

const PACKAGE_KIND = {
  capabilities: "dist",
  "capabilities-ai-sdk": "dist",
  "capabilities-otel": "dist",
  "capabilities-spec": "spec",
} as const satisfies Record<ReleasePackage, "dist" | "spec">;

export function isReleasePackage(name: string): name is ReleasePackage {
  return (RELEASE_PACKAGES as readonly string[]).includes(name);
}

export type StageAgentCapabilitiesReleaseOptions = {
  workspaceRoot: string;
  packageName: ReleasePackage;
  version: string;
};

export type StageAgentCapabilitiesReleaseResult = {
  releaseDir: string;
  packageName: ReleasePackage;
};

function resolveWorkspaceDependencies(
  dependencies: Record<string, string> | undefined,
  peerDependencies: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!dependencies) return undefined;
  const out: Record<string, string> = {};
  for (const [name, spec] of Object.entries(dependencies)) {
    if (spec.startsWith("workspace:")) {
      const peer = peerDependencies?.[name];
      if (!peer) {
        throw new Error(`workspace dependency ${name} has no peer range to publish`);
      }
      out[name] = peer;
    } else {
      out[name] = spec;
    }
  }
  return out;
}

function copyDistPackage(pkgDir: string, releaseDir: string): void {
  const distDir = path.join(pkgDir, "dist");
  if (!existsSync(distDir)) {
    throw new Error(`missing dist at ${distDir}; run package build first`);
  }
  cpSync(distDir, path.join(releaseDir, "dist"), { recursive: true });
  for (const file of ["README.md", "LICENSE"]) {
    const src = path.join(pkgDir, file);
    if (existsSync(src)) cpSync(src, path.join(releaseDir, file));
  }
}

function copySpecPackage(pkgDir: string, releaseDir: string): void {
  cpSync(path.join(pkgDir, "model"), path.join(releaseDir, "model"), { recursive: true });
  for (const file of ["smithy-build.json", "README.md", "LICENSE"]) {
    const src = path.join(pkgDir, file);
    if (!existsSync(src)) throw new Error(`missing ${file} at ${pkgDir}`);
    cpSync(src, path.join(releaseDir, file));
  }
}

export async function stageAgentCapabilitiesRelease(
  opts: StageAgentCapabilitiesReleaseOptions,
): Promise<StageAgentCapabilitiesReleaseResult> {
  const { workspaceRoot, packageName, version } = opts;
  const pkgDir = path.join(workspaceRoot, "packages", packageName);
  const pkgJsonPath = path.join(pkgDir, "package.json");

  if (!existsSync(pkgJsonPath)) {
    throw new Error(`missing package at ${pkgDir}`);
  }

  const source = JSON.parse(await Bun.file(pkgJsonPath).text()) as Record<string, unknown>;
  const releaseDir = path.join(workspaceRoot, "release", packageName);

  if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  const kind = PACKAGE_KIND[packageName];
  if (kind === "dist") {
    copyDistPackage(pkgDir, releaseDir);
  } else {
    copySpecPackage(pkgDir, releaseDir);
  }

  const staged: Record<string, unknown> = {
    name: source.name,
    version,
    description: source.description,
    license: source.license,
    type: source.type ?? "module",
    files: source.files,
    repository: source.repository,
    homepage: source.homepage,
    bugs: source.bugs,
    keywords: source.keywords,
    publishConfig: { access: "public", ...(source.publishConfig as object | undefined) },
  };

  if (kind === "dist") {
    staged.sideEffects = source.sideEffects;
    staged.engines = source.engines;
    staged.main = source.main;
    staged.types = source.types;
    staged.exports = source.exports;
    staged.peerDependencies = source.peerDependencies;
    const deps = resolveWorkspaceDependencies(
      source.dependencies as Record<string, string> | undefined,
      source.peerDependencies as Record<string, string> | undefined,
    );
    if (deps) staged.dependencies = deps;
  }

  await Bun.write(path.join(releaseDir, "package.json"), `${JSON.stringify(staged, null, 2)}\n`);

  return { releaseDir, packageName };
}

if (import.meta.main) {
  const packageName = process.argv[2];
  const version = process.argv[3];
  if (!packageName || !isReleasePackage(packageName)) {
    console.error(
      "usage: stage-agent-capabilities-release.ts <capabilities|capabilities-ai-sdk|capabilities-otel|capabilities-spec> <semver>",
    );
    process.exit(1);
  }
  if (!version || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
    console.error("invalid semver:", version);
    process.exit(1);
  }
  const workspaceRoot = path.resolve(import.meta.dir, "..");
  const result = await stageAgentCapabilitiesRelease({ workspaceRoot, packageName, version });
  console.log(`staged ${result.packageName} → ${path.relative(workspaceRoot, result.releaseDir)}`);
}
