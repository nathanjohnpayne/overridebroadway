/**
 * A failed investor / producer-pool subscription must never render as valid
 * zero or stale capitalization data (#181 review). ProductionHubClient
 * withholds every figure derived from them and shows an alert instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_DEAL_INPUTS } from "@/types/deal";

// Every mocked hook returns a STABLE reference: the hub's effects depend on
// router / user / dealInputs, so fresh objects per render would loop forever.
const stable = vi.hoisted(() => ({
  router: { push: () => {}, replace: () => {} },
  auth: { user: { uid: "owner-1" } },
  params: new URLSearchParams("id=prod-1"),
  deal: { dealInputs: null as unknown, loading: false, saving: false, save: () => {} },
}));

const hooks = vi.hoisted(() => ({
  investors: {
    investors: [] as unknown[],
    loading: false,
    error: null as Error | null,
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  pools: {
    pools: [] as unknown[],
    loading: false,
    error: null as Error | null,
    defaultPoolId: null,
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => stable.params,
  useRouter: () => stable.router,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => stable.auth,
}));
stable.deal.dealInputs = { ...DEFAULT_DEAL_INPUTS, totalCapitalization: 1_000_000 };
vi.mock("@/hooks/useDealInputs", () => ({ useDealInputs: () => stable.deal }));
vi.mock("@/hooks/useInvestors", () => ({ useInvestors: () => hooks.investors }));
vi.mock("@/hooks/useProducerPools", () => ({ useProducerPools: () => hooks.pools }));
vi.mock("@/lib/firestore", () => ({
  getProduction: vi.fn(async () => ({
    id: "prod-1",
    userId: "owner-1",
    name: "Test Show",
    status: "development",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  })),
  updateProduction: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  uploadProductionArtwork: vi.fn(),
  uploadOperatingAgreement: vi.fn(),
  uploadProductionDocument: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({
  Analytics: new Proxy({}, { get: () => vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
for (const mod of [
  "DealBuilder",
  "WaterfallFlow",
  "DealRoomSetup",
  "InvestorSheet",
  "InvestorStatusBadge",
  "ProducerLedger",
  "PoolDialog",
]) {
  vi.doMock(`@/app/(app)/productions/view/${mod}`, () => ({ [mod]: () => null }));
}

async function renderHub() {
  const { default: ProductionHubClient } = await import(
    "@/app/(app)/productions/view/ProductionHubClient"
  );
  render(<ProductionHubClient />);
  await waitFor(() => expect(screen.getAllByText("Test Show").length).toBeGreaterThan(0));
}

describe("ProductionHubClient — investor/pool load failure", () => {
  beforeEach(() => {
    hooks.investors.error = null;
    hooks.pools.error = null;
  });

  it("shows an alert and withholds investor figures when the investor listener fails", async () => {
    hooks.investors.error = new Error("permission-denied");
    await renderHub();
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => /couldn.t load this production.s investors or producer pools/i.test(a.textContent ?? ""))).toBe(true);
    // The investor count is not reported as a (false) zero.
    expect(screen.queryByText("Investors:")?.parentElement?.textContent).toContain("—");
  });

  it("treats a producer-pool listener failure the same way", async () => {
    hooks.pools.error = new Error("unavailable");
    await renderHub();
    expect(
      screen.getAllByRole("alert").some((a) => /investors or producer pools/i.test(a.textContent ?? "")),
    ).toBe(true);
  });

  it("withholds investor figures (no false zero) while a listener is still loading", async () => {
    hooks.investors.loading = true;
    try {
      await renderHub();
      expect(screen.queryByText("Investors:")?.parentElement?.textContent).toContain("—");
      expect(
        screen.queryAllByRole("alert").some((a) => /investors or producer pools/i.test(a.textContent ?? "")),
      ).toBe(false);
    } finally {
      hooks.investors.loading = false;
    }
  });

  it("renders normally with no alert when both listeners succeed", async () => {
    await renderHub();
    expect(
      screen.queryAllByRole("alert").some((a) => /investors or producer pools/i.test(a.textContent ?? "")),
    ).toBe(false);
    expect(screen.queryByText("Investors:")?.parentElement?.textContent).toContain("0");
  });
});
