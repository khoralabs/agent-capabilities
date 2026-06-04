import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const pkgRoot = join(import.meta.dir, "../..");
const cliPath = join(pkgRoot, "src/cli/capability-diff.ts");
const fixtureA = join(pkgRoot, "fixtures/diff/link-a.json");
const fixtureB = join(pkgRoot, "fixtures/diff/link-b-same.json");

describe("capability-diff CLI", () => {
  test("prints summary for identical link fixtures", async () => {
    const proc = Bun.spawn(["bun", "run", cliPath, fixtureA, fixtureB], {
      cwd: pkgRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Summary:");
    expect(stdout).toContain("Same capability link.");
  });
});
