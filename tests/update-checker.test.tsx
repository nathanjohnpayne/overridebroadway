/**
 * @spec update-checker
 *
 * Tests for the UpdateChecker component: build ID polling,
 * refresh prompt, error handling, and development-mode skipping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// We need to control process.env and mock fetch per-test, so we import the
// component dynamically after setting up environment.

let originalNodeEnv: string | undefined;
let originalBuildId: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  originalNodeEnv = process.env.NODE_ENV;
  originalBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
  // Reset fetch mock
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.env.NODE_ENV = originalNodeEnv;
  process.env.NEXT_PUBLIC_BUILD_ID = originalBuildId;
  cleanup();
});

// ---------------------------------------------------------------------------
// Helper: Create a fresh UpdateChecker with specific env values
//
// Because CURRENT_BUILD_ID is captured at module parse time, we need to
// re-evaluate the module for each test. We use dynamic import with cache
// busting via vi.resetModules().
// ---------------------------------------------------------------------------

async function createUpdateChecker(envOverrides: {
  NODE_ENV?: string;
  NEXT_PUBLIC_BUILD_ID?: string;
}) {
  // Set env vars BEFORE module is parsed
  if (envOverrides.NODE_ENV !== undefined) {
    process.env.NODE_ENV = envOverrides.NODE_ENV;
  }
  if (envOverrides.NEXT_PUBLIC_BUILD_ID !== undefined) {
    process.env.NEXT_PUBLIC_BUILD_ID = envOverrides.NEXT_PUBLIC_BUILD_ID;
  }

  // Force re-evaluation of the module
  vi.resetModules();

  // Re-mock sonner after resetModules
  vi.doMock("sonner", () => ({
    toast: (...args: unknown[]) => mockToast(...args),
  }));

  const mod = await import("@/components/UpdateChecker");
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UpdateChecker", () => {
  describe("development mode", () => {
    it("does not fetch when NODE_ENV is not production", async () => {
      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "development",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      render(<UpdateChecker />);

      // Advance timers past the initial check and one interval
      await act(async () => {
        vi.advanceTimersByTime(120_000);
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("missing build ID", () => {
    it("does not fetch when CURRENT_BUILD_ID is empty", async () => {
      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(120_000);
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("production mode with matching build ID", () => {
    it("fetches /_build_id.txt on mount and does NOT show toast when IDs match", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("build-abc"),
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-abc",
      });

      render(<UpdateChecker />);

      // Flush the initial check (runs in the useEffect)
      await act(async () => {
        vi.advanceTimersByTime(0);
        // Allow the async fetch to resolve
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(callUrl).toMatch(/^\/_build_id\.txt\?t=\d+$/);

      // No toast because IDs match
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe("production mode with mismatched build ID", () => {
    it("shows a persistent toast with Refresh action when a new build is detected", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("build-NEW"),
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-OLD",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        "A new version of Override is available.",
        expect.objectContaining({
          duration: Infinity,
          action: expect.objectContaining({
            label: "Refresh",
          }),
        }),
      );
    });
  });

  describe("polling interval", () => {
    it("polls every 60 seconds after the initial check", async () => {
      let callCount = 0;
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("same-build"),
        });
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "same-build",
      });

      render(<UpdateChecker />);

      // Initial check
      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      const initialCalls = callCount;

      // Advance by one interval (60s)
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(callCount).toBe(initialCalls + 1);

      // Advance by another interval
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(callCount).toBe(initialCalls + 2);
    });
  });

  describe("error handling", () => {
    it("silently swallows network errors without showing a toast", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetch).toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it("does not show toast when response is not OK (e.g. 404)", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetch).toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("clears the interval on unmount", async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("build-123"),
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      const { unmount } = render(<UpdateChecker />);

      // Let the effect run
      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("render output", () => {
    it("renders nothing visible (returns null)", async () => {
      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "development",
        NEXT_PUBLIC_BUILD_ID: "",
      });

      const { container } = render(<UpdateChecker />);

      expect(container.innerHTML).toBe("");
    });
  });

  describe("cache busting", () => {
    it("appends a timestamp query parameter to bypass CDN caches", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("build-123"),
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("/_build_id.txt?t=");

      // The fetch should use no-store cache policy
      const options = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(options).toEqual(expect.objectContaining({ cache: "no-store" }));
    });
  });

  describe("whitespace handling", () => {
    it("trims the fetched build ID before comparing", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("  build-123  \n"),
      });

      const UpdateChecker = await createUpdateChecker({
        NODE_ENV: "production",
        NEXT_PUBLIC_BUILD_ID: "build-123",
      });

      render(<UpdateChecker />);

      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should NOT show toast because trimmed value matches
      expect(mockToast).not.toHaveBeenCalled();
    });
  });
});
