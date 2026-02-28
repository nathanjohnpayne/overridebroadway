"use client";

/**
 * DealRoomClient — the investor-facing entry point for a shared deal room.
 *
 * Reads the ?token= query param, fetches the DealRoom document from Firestore
 * (no auth required — security rules allow read when isActive = true), and
 * renders DealRoomView with the fetched data.
 *
 * No authentication is required or checked here. This route is intentionally
 * public — the token IS the access credential.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDealRoom } from "@/lib/firestore";
import { Analytics } from "@/lib/analytics";
import type { DealRoom } from "@/types/dealRoom";
import DealRoomView from "./DealRoomView";

type LoadState = "loading" | "not_found" | "inactive" | "error" | "ready";

export default function DealRoomClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [dealRoom, setDealRoom] = useState<DealRoom | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!token) {
      setLoadState("not_found");
      return;
    }

    async function load() {
      try {
        const room = await getDealRoom(token!);
        if (!room) {
          setLoadState("not_found");
          return;
        }
        if (!room.isActive) {
          setLoadState("inactive");
          return;
        }
        setDealRoom(room);
        setLoadState("ready");
        // Track investor view — fire and forget
        Analytics.dealRoomViewed(token!);
      } catch (err) {
        console.error("Failed to load deal room:", err);
        setLoadState("error");
      }
    }

    load();
  }, [token]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading deal room…</p>
        </div>
      </div>
    );
  }

  // ── Not found / inactive / error ──────────────────────────────────────────
  if (loadState === "not_found" || loadState === "inactive" || loadState === "error") {
    const messages: Record<"not_found" | "inactive" | "error", { title: string; body: string }> = {
      not_found: {
        title: "Deal room not found",
        body: "This link may have expired or been removed. Please contact the producer for an updated link.",
      },
      inactive: {
        title: "This deal room is no longer active",
        body: "The producer has closed access to this deal room. Please contact them directly for current information.",
      },
      error: {
        title: "Something went wrong",
        body: "We couldn't load the deal room. Please try again or contact the producer.",
      },
    };
    const msg = messages[loadState as "not_found" | "inactive" | "error"];

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          {/* Override wordmark */}
          <div className="text-2xl font-bold tracking-tight text-foreground mb-6">
            Override
          </div>
          <div className="rounded-lg border bg-card p-8 space-y-3 shadow-sm">
            <h1 className="text-xl font-semibold">{msg.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{msg.body}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <span className="font-medium text-foreground">Override</span>
            {"—"}the financial platform for Broadway producers.
          </p>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  if (!dealRoom) return null;
  return <DealRoomView dealRoom={dealRoom} />;
}
