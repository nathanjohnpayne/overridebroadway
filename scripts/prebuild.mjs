// Generates a fresh build ID and writes it to .build_id so that both
// next.config.ts (via fs.readFileSync at config-evaluation time) and
// scripts/postbuild.mjs can use the same value.
import { writeFileSync } from "fs";

const buildId = Date.now().toString();
writeFileSync(".build_id", buildId, "utf8");
console.log(`✓ .build_id → ${buildId}`);
