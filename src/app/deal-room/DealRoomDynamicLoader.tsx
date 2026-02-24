"use client";
import dynamic from "next/dynamic";

const DealRoomClient = dynamic(
  () => import("./DealRoomClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading deal room…</p>
      </div>
    ),
  }
);

export default function DealRoomDynamicLoader() {
  return <DealRoomClient />;
}
