"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, FileText, ArrowRight, DollarSign, Users, Briefcase, Share2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-xl tracking-tight">Override</span>
          <span className="hidden sm:block text-xs text-muted-foreground border-l pl-3">
            You run the show. Override runs the money.
          </span>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button>
          <Button asChild><Link href="/signup">Get Started</Link></Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <Badge className="mb-6" variant="secondary">Broadway Deal Modeling & Investor Management</Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-4">Override</h1>
        <p className="text-2xl text-muted-foreground font-medium mb-6">You run the show. Override runs the money.</p>
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
          The financial operating platform for Broadway producers—from structuring your capitalization
          to managing investors, stress-testing deals, and sharing terms with your backers.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" asChild>
            <Link href="/signup">Start for free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything a producer needs</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A complete production workspace—financial modeling, investor CRM, and a private deal room for your backers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: DollarSign,
                title: "Waterfall Modeling",
                desc: "Recoup-first or share-from-dollar-one. Configure creative splits, running royalty offsets, and GP fee structures with industry-standard defaults.",
              },
              {
                icon: BarChart3,
                title: "Scenario Analysis",
                desc: "Bear, Base, and Bull scenarios side-by-side. Sensitivity grids across occupancy rates and run lengths show your full investor outcome surface.",
              },
              {
                icon: TrendingUp,
                title: "Investor Returns",
                desc: "Per-investor ROI, cash-on-cash multiples, IRR, and recoupment forecasts—automatically driven from your cap table.",
              },
              {
                icon: Users,
                title: "Cap Table & Investor Ledger",
                desc: "Track every investor's commitment, funded amount, ownership %, and subscription status from invited through fully admitted.",
              },
              {
                icon: FileText,
                title: "Documents",
                desc: "Attach production-level agreements and per-investor executed copies of the instruction letter, signature page, and subscription agreement—organized by stage.",
              },
              {
                icon: Share2,
                title: "Investor Deal Room",
                desc: "Share a private link with backers—no login required. They see your deal structure, Bear/Base/Bull scenarios, and waterfall visualization. You control what's visible.",
              },
              {
                icon: Briefcase,
                title: "My Investments View",
                desc: "Tag productions where you have a personal stake. A dedicated dashboard view surfaces just your investments at a glance.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-background rounded-xl p-6 border">
                <Icon className="h-8 w-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">From term sheet to cap table in minutes</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            {
              step: "01",
              title: "Structure the deal",
              desc: "Enter capitalization, weekly nut, royalties, house fees, and waterfall rules. Guided mode walks you through each section.",
            },
            {
              step: "02",
              title: "Stress-test the model",
              desc: "Instant cash flow forecasts, recoupment timelines, per-investor returns, and a full occupancy × run-length sensitivity grid.",
            },
            {
              step: "03",
              title: "Build your cap table",
              desc: "Add investors with contact details, track commitments vs. funded amounts, and monitor each investor's subscription status.",
            },
            {
              step: "04",
              title: "Share with backers",
              desc: "Generate a private Deal Room link. Investors see your economics and scenarios—no account required.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="text-5xl font-bold text-muted-foreground/30 mb-3">{step}</div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 bg-primary text-primary-foreground text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to stress-test your deal?</h2>
        <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
          Built for Broadway producers who want transparent, auditable financials—and a better way to bring investors into the conversation.
        </p>
        <Button size="lg" variant="secondary" asChild>
          <Link href="/signup">Create your first production <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Override · For educational and planning purposes only · Not financial advice.</p>
      </footer>
    </div>
  );
}
