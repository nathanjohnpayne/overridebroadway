"use client";
import dynamic from "next/dynamic";

const ProductionHubClient = dynamic(
  () => import("./ProductionHubClient"),
  { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground">Loading...</div> }
);

export default function ProductionDynamicLoader() {
  return <ProductionHubClient />;
}
