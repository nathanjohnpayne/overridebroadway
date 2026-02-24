"use client";

import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Users } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/model/formatters";
import type { OwnershipRollup } from "@/lib/model/ownershipRollup";
import type { CapitalizationInvestor } from "@/types/capitalization";
import { InvestorStatusBadge } from "./InvestorStatusBadge";

interface ProducerLedgerProps {
  rollup: OwnershipRollup;
  onEditInvestor: (investor: CapitalizationInvestor) => void;
  onDeleteInvestor: (investor: CapitalizationInvestor) => void;
  onAddInvestorToPool: (poolId: string) => void;
  onEditPool: (poolId: string) => void;
  onDeletePool: (poolId: string) => void;
}

export function ProducerLedger({
  rollup,
  onEditInvestor,
  onDeleteInvestor,
  onAddInvestorToPool,
  onEditPool,
  onDeletePool,
}: ProducerLedgerProps) {
  // Start with all pools expanded
  const [expandedPools, setExpandedPools] = useState<Set<string>>(
    () => new Set(rollup.pools.map((po) => po.pool.id))
  );

  function togglePool(poolId: string) {
    setExpandedPools((prev) => {
      const next = new Set(prev);
      if (next.has(poolId)) next.delete(poolId);
      else next.add(poolId);
      return next;
    });
  }

  if (rollup.pools.length === 0) {
    return (
      <div className="text-center py-10">
        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No pools yet. Create a pool to group investors.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Pool / Investor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Committed</TableHead>
          <TableHead className="text-right">Funded</TableHead>
          <TableHead className="text-right">Ownership %</TableHead>
          <TableHead className="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rollup.pools.map((po) => {
          const isExpanded = expandedPools.has(po.pool.id);
          const isDefault = po.pool.name === "Direct Investors";
          return (
            <React.Fragment key={po.pool.id}>
              {/* Pool header row */}
              <TableRow
                className="bg-muted/40 cursor-pointer hover:bg-muted/60"
                onClick={() => togglePool(po.pool.id)}
              >
                <TableCell className="pl-4">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
                <TableCell className="font-semibold">
                  {po.pool.name}
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    {po.investorCount} investor{po.investorCount !== 1 ? "s" : ""}
                  </span>
                  {po.pool.allocationLimit && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Limit: {formatCurrency(po.pool.allocationLimit)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">—</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(po.totalCommitted)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(po.totalFunded)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatPercent(po.poolOwnershipPercent)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="Add investor to pool"
                      onClick={() => onAddInvestorToPool(po.pool.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => onEditPool(po.pool.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isDefault}
                      title={isDefault ? "Cannot delete the default pool" : "Delete pool"}
                      onClick={() => onDeletePool(po.pool.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              {/* Expanded investor rows */}
              {isExpanded && po.investors.length === 0 && (
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={6} className="pl-10 text-sm text-muted-foreground py-3 italic">
                    No investors in this pool.
                  </TableCell>
                </TableRow>
              )}
              {isExpanded && po.investors.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-background/60">
                  <TableCell />
                  <TableCell className="pl-10 text-sm">
                    {inv.name}
                    {inv.isPersonalInvestment && (
                      <Badge variant="outline" className="ml-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200">Me</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <InvestorStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(inv.amountCommitted)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(inv.amountFunded)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {rollup.totalCapitalization > 0
                      ? formatPercent(inv.amountCommitted / rollup.totalCapitalization)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => onEditInvestor(inv)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDeleteInvestor(inv)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          );
        })}

        {/* Unassigned investors (shouldn't happen after migration, but defensive) */}
        {rollup.unassigned.length > 0 && rollup.unassigned.map((inv) => (
          <TableRow key={inv.id} className="bg-yellow-50/40">
            <TableCell />
            <TableCell className="pl-10 text-sm">
              {inv.name}
              <Badge variant="outline" className="ml-2 text-xs">Unassigned</Badge>
            </TableCell>
            <TableCell><InvestorStatusBadge status={inv.status} /></TableCell>
            <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountCommitted)}</TableCell>
            <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountFunded)}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {rollup.totalCapitalization > 0
                ? formatPercent(inv.amountCommitted / rollup.totalCapitalization)
                : "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditInvestor(inv)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteInvestor(inv)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
