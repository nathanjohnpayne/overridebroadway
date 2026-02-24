"use client";

import { Badge } from "@/components/ui/badge";
import type { InvestorStatus } from "@/types/capitalization";

export const INVESTOR_STATUS_COLORS: Record<InvestorStatus, string> = {
  invited:   "bg-gray-100 text-gray-700",
  docs_sent: "bg-blue-100 text-blue-700",
  signed:    "bg-yellow-100 text-yellow-700",
  funded:    "bg-green-100 text-green-700",
  admitted:  "bg-purple-100 text-purple-700",
};

export function InvestorStatusBadge({ status }: { status: InvestorStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs capitalize ${INVESTOR_STATUS_COLORS[status]}`}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}
