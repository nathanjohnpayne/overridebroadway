import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";

// Stamped once per build by scripts/prebuild.mjs — used by UpdateChecker
// to detect when a new version has been deployed to Firebase Hosting.
const BUILD_ID = existsSync(".build_id")
  ? readFileSync(".build_id", "utf8").trim()
  : Date.now().toString();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
