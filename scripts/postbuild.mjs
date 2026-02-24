// Copies the build ID stamp into out/_build_id.txt so the UpdateChecker
// component can poll it and detect new deployments.
import { writeFileSync, readFileSync, existsSync } from "fs";

// The build ID is written to .build_id by prebuild.mjs and also inlined
// into the Next.js bundle via next.config.ts env.NEXT_PUBLIC_BUILD_ID.
let buildId;
if (existsSync(".build_id")) {
  buildId = readFileSync(".build_id", "utf8").trim();
} else {
  buildId = Date.now().toString();
}

writeFileSync("out/_build_id.txt", buildId, "utf8");
console.log(`✓ out/_build_id.txt → ${buildId}`);
