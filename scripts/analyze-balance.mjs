import fs from "node:fs/promises";
import path from "node:path";
import { summarizeBalance } from "../src/balance-metrics.js";
import { BLOODLINES } from "../src/progression.js";

const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log("node scripts/analyze-balance.mjs <simulation-report.json> [output.json]");
  process.exit(0);
}
if (args.length > 2) throw new Error("Expected an input report and optional output path");
const input = path.resolve(args[0]), stat = await fs.stat(input);
if (stat.size > 64 * 1024 * 1024) throw new Error("Balance report exceeds 64MB analysis budget");
const report = JSON.parse(await fs.readFile(input, "utf8")), rows = Array.isArray(report) ? report : report.attempts;
if (!Array.isArray(rows) || rows.length > 10000) throw new Error("Expected up to 10,000 simulation attempts");
const summary = summarizeBalance(rows, { branchIds: BLOODLINES.map((branch) => branch.speciesId) });
if (args[1]) {
  const output = path.resolve(args[1]);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(JSON.stringify(summary, null, 2));
