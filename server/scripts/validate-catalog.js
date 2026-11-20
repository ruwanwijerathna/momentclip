#!/usr/bin/env node
// Usage: node scripts/validate-catalog.js [path/to/convocations.json]
import fs from "node:fs";
import { validateCatalog } from "../src/catalog.js";

const file = process.argv[2] || "catalog/convocations.json";
let raw;
try {
  raw = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`✗ Could not parse ${file}: ${e.message}`);
  process.exit(1);
}
const { errors, warnings, stats } = validateCatalog(raw);
warnings.forEach((w) => console.warn(`! ${w}`));
errors.forEach((e) => console.error(`✗ ${e}`));
console.log(
  `${errors.length ? "✗" : "✓"} ${file}: ${stats.universities} universities · ${stats.convocations} convocations · ` +
    `${stats.days} days · ${stats.sessions} sessions · ${stats.markers} markers · ${errors.length} errors · ${warnings.length} warnings`
);
process.exit(errors.length ? 1 : 0);
