"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// How often to poll for a new deployment (ms)
const POLL_INTERVAL = 60_000; // 1 minute

// The build ID baked into this page at build time
const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

export default function UpdateChecker() {
  useEffect(() => {
    // Don't run in dev (no _build_id.txt exists locally)
    if (process.env.NODE_ENV !== "production") return;
    // Nothing to compare against — skip
    if (!CURRENT_BUILD_ID) return;

    async function check() {
      try {
        const res = await fetch(`/_build_id.txt?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.text()).trim();
        if (latest && latest !== CURRENT_BUILD_ID) {
          toast("A new version of Override is available.", {
            duration: Infinity,
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // Network error — silently ignore, try again next interval
      }
    }

    // Check once on mount (catches updates that happened while the tab was closed)
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}
