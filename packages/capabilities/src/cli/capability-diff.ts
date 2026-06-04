import {
  buildCapabilityDiffJsonReport,
  formatCapabilityDiffReport,
} from "./capability-diff-report.js";
import { extractDiffSources, parseDiffInput } from "./parse-diff-input.js";

export type CapabilityDiffCliOptions = {
  json?: boolean;
  labelA?: string;
  labelB?: string;
};

function parseArgv(argv: string[]): {
  paths: [string, string];
  options: CapabilityDiffCliOptions;
} {
  const paths: string[] = [];
  const options: CapabilityDiffCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--label-a") {
      options.labelA = argv[++i];
      continue;
    }
    if (arg === "--label-b") {
      options.labelB = argv[++i];
      continue;
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (arg) {
      paths.push(arg);
    }
  }
  const first = paths[0];
  const second = paths[1];
  if (first === undefined || second === undefined) {
    throw new Error(
      "Usage: capability-diff <first.json> <second.json> [--json] [--label-a name] [--label-b name]",
    );
  }
  return { paths: [first, second], options };
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await Bun.file(path).text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${path}`);
  }
}

export async function runCapabilityDiff(argv: string[]): Promise<number> {
  try {
    const { paths, options } = parseArgv(argv);
    const [pathA, pathB] = paths;
    const rawA = await readJsonFile(pathA);
    const rawB = await readJsonFile(pathB);
    const first = extractDiffSources(parseDiffInput(rawA));
    const second = extractDiffSources(parseDiffInput(rawB));
    const labels = {
      first: options.labelA ?? pathA,
      second: options.labelB ?? pathB,
    };
    if (options.json) {
      const report = buildCapabilityDiffJsonReport({ first, second, labels });
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatCapabilityDiffReport({ first, second, labels }));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

if (import.meta.main) {
  const code = await runCapabilityDiff(process.argv.slice(2));
  process.exit(code);
}
