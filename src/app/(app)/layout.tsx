"use client";
import { useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Briefcase, LogOut, ChevronDown, User } from "lucide-react";
import { toast } from "sonner";

// Isolated into its own component so useSearchParams() is wrapped in Suspense
function NavButtons() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInvestmentsView = pathname === "/dashboard" && searchParams.get("view") === "investments";
  return (
    <>
      <Button
        variant={pathname === "/dashboard" && !isInvestmentsView ? "secondary" : "ghost"}
        size="sm"
        asChild
      >
        <Link href="/dashboard">
          <LayoutDashboard className="h-4 w-4 mr-1.5" />
          Productions
        </Link>
      </Button>
      <Button
        variant={isInvestmentsView ? "secondary" : "ghost"}
        size="sm"
        asChild
      >
        <Link href="/dashboard?view=investments">
          <Briefcase className="h-4 w-4 mr-1.5" />
          My Investments
        </Link>
      </Button>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Show skeleton while Firebase restores auth session — never flash redirect
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
      toast.success("Signed out successfully.");
    } catch {
      toast.error("Failed to sign out.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b bg-background px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight hidden sm:block whitespace-nowrap">Override</span>
          <span className="hidden md:block text-xs text-muted-foreground whitespace-nowrap border-l pl-3 ml-1">
            You run the show. Override runs the money.
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Suspense fallback={null}>
            <NavButtons />
          </Suspense>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">{user.displayName ?? user.email}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {user.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>
      <main className="flex-1 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
