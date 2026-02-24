"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useProductions } from "@/hooks/useProductions";
import { useAuth } from "@/contexts/AuthContext";
import { createProduction, deleteProduction } from "@/lib/firestore";
import { Analytics } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronRight, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Production, ProductionStatus } from "@/types/production";

const STATUS_COLORS: Record<ProductionStatus, string> = {
  development: "bg-yellow-100 text-yellow-800",
  preview: "bg-blue-100 text-blue-800",
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

/**
 * Renders a production artwork image in a fixed-height letterbox.
 * A blurred, scaled-up copy of the same image fills the background so the
 * letterbox matte picks up the dominant image color — no canvas or CORS needed.
 */
function ArtworkBanner({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="h-44 overflow-hidden relative">
      {/* Background layer: oversized by 40px on every side so the blur's soft
          transparent edges are pushed outside the container and clipped cleanly
          by overflow-hidden — no white gaps at the corners. */}
      <div
        className="absolute"
        style={{
          inset: "-40px",
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(24px)",
        }}
      />
      {/* Foreground: crisp contained image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="relative w-full h-full object-contain block"
      />
    </div>
  );
}

export default function DashboardPage() {
  const { productions, loading } = useProductions();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<ProductionStatus>("development");
  const [creating, setCreating] = useState(false);
  const [dashView, setDashView] = useState<"productions" | "investments">("productions");
  const [deleteTarget, setDeleteTarget] = useState<Production | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sync view with ?view= query param — runs on mount and on every URL change
  useEffect(() => {
    setDashView(searchParams.get("view") === "investments" ? "investments" : "productions");
  }, [searchParams]);

  const investmentProductions = productions.filter(p => p.hasPersonalInvestment);
  const displayedProductions = dashView === "productions" ? productions : investmentProductions;

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduction(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete production.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      const id = await createProduction(user.uid, { name, subtitle, venue, status, userId: user.uid });
      Analytics.productionCreated();
      toast.success(`${name} created!`);
      setDialogOpen(false);
      setName(""); setSubtitle(""); setVenue(""); setStatus("development");
      router.push(`/productions/view?id=${id}&new=1`);
    } catch {
      toast.error("Failed to create production.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {dashView === "productions" ? "Your Productions" : "My Investments"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dashView === "productions"
              ? `${productions.length} production${productions.length !== 1 ? "s" : ""} in your portfolio`
              : `${investmentProductions.length} production${investmentProductions.length !== 1 ? "s" : ""} where you are an investor`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 transition-colors ${dashView === "productions" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              onClick={() => setDashView("productions")}
            >
              My Productions
            </button>
            <button
              className={`px-3 py-1.5 border-l transition-colors ${dashView === "investments" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              onClick={() => setDashView("investments")}
            >
              My Investments
            </button>
          </div>

          {/* New Production dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Production</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Production</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="prod-name">Production Name *</Label>
                  <Input id="prod-name" value={name} onChange={e => setName(e.target.value)} placeholder="Hamilton" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtitle / Tagline</Label>
                  <Input id="subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="An American Musical" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue / Theatre</Label>
                  <Input id="venue" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Richard Rodgers Theatre" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={v => setStatus(v as ProductionStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="preview">In Preview</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={creating || !name.trim()}>
                    {creating ? "Creating..." : "Create Production"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : displayedProductions.length === 0 ? (
        dashView === "productions" ? (
          <div className="text-center py-24 text-muted-foreground">
            <span className="text-6xl block mb-4">🎭</span>
            <h2 className="text-xl font-semibold mb-2">No productions yet</h2>
            <p className="text-sm mb-6">Create your first production to start modeling its deal structure.</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Production</Button>
          </div>
        ) : (
          <div className="text-center py-24 text-muted-foreground">
            <span className="text-6xl block mb-4">💼</span>
            <h2 className="text-xl font-semibold mb-2">No personal investments tracked</h2>
            <p className="text-sm max-w-sm mx-auto">
              Open a production, go to the <strong>Capitalization</strong> tab, add yourself as an investor, and check &ldquo;This is my personal investment.&rdquo;
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedProductions.map(prod => (
            <div key={prod.id} className="relative group rounded-xl border ring-0 shadow-sm hover:shadow-md transition-shadow">
              <Link href={`/productions/view?id=${prod.id}`}>
                <Card className="cursor-pointer h-full pt-0 overflow-hidden border-0 shadow-none">
                  {prod.artworkUrl ? (
                    <ArtworkBanner url={prod.artworkUrl} alt={prod.name} />
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-primary/10 to-primary/30 rounded-t-xl flex items-center justify-center text-5xl">
                      🎭
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{prod.name}</h3>
                        {prod.subtitle && <p className="text-xs text-muted-foreground">{prod.subtitle}</p>}
                        {prod.venue && <p className="text-xs text-muted-foreground">{prod.venue}</p>}
                      </div>
                      <Badge className={STATUS_COLORS[prod.status] + " text-xs capitalize shrink-0"} variant="outline">
                        {prod.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Updated {prod.updatedAt.toLocaleDateString()}</span>
                    <ChevronRight className="h-4 w-4" />
                  </CardContent>
                </Card>
              </Link>
              {/* Three-dot menu — sits on top of the card link */}
              <div className="absolute top-2 right-2 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background"
                      onClick={e => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={e => { e.preventDefault(); setDeleteTarget(prod); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete production
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>

      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This will permanently delete the production and all its deal inputs, scenarios, and investor records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
