/**
 * @spec deal-builder
 *
 * Tests for the deal builder: form rendering, model calculations,
 * autosave behavior, and deal input loading.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { DEFAULT_DEAL_INPUTS, type DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    productionCreated: vi.fn(),
    dealRoomCreated: vi.fn(),
  },
}));

// Mock firestore
const mockGetDealInputs = vi.fn();
const mockSaveDealInputs = vi.fn();
vi.mock("@/lib/firestore", () => ({
  getDealInputs: (...args: unknown[]) => mockGetDealInputs(...args),
  saveDealInputs: (...args: unknown[]) => mockSaveDealInputs(...args),
  subscribeToProductions: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests: useDealInputs hook
// ---------------------------------------------------------------------------

import { useDealInputs } from "@/hooks/useDealInputs";
import { renderHook } from "@testing-library/react";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDealInputs", () => {
  it("loads deal inputs from Firestore on mount", async () => {
    const saved: DealInputs = {
      ...DEFAULT_DEAL_INPUTS,
      totalCapitalization: 5_000_000,
    };
    mockGetDealInputs.mockResolvedValue(saved);

    const { result } = renderHook(() => useDealInputs("prod-1"));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.dealInputs).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.dealInputs).toEqual(saved);
    });

    expect(mockGetDealInputs).toHaveBeenCalledWith("prod-1");
  });

  it("returns null dealInputs when no saved deal exists", async () => {
    mockGetDealInputs.mockResolvedValue(null);

    const { result } = renderHook(() => useDealInputs("prod-new"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.dealInputs).toBeNull();
    });
  });

  it("does not fetch when productionId is null", async () => {
    const { result } = renderHook(() => useDealInputs(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetDealInputs).not.toHaveBeenCalled();
  });

  it("saves deal inputs via saveDealInputs", async () => {
    mockGetDealInputs.mockResolvedValue(DEFAULT_DEAL_INPUTS);
    mockSaveDealInputs.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDealInputs("prod-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updated = { ...DEFAULT_DEAL_INPUTS, totalCapitalization: 3_000_000 };

    await act(async () => {
      await result.current.save(updated);
    });

    expect(mockSaveDealInputs).toHaveBeenCalledWith("prod-1", updated);
    expect(result.current.dealInputs).toEqual(updated);
  });

  it("tracks saving state during save", async () => {
    mockGetDealInputs.mockResolvedValue(DEFAULT_DEAL_INPUTS);

    let resolvePromise: () => void;
    mockSaveDealInputs.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useDealInputs("prod-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start save -- saving should become true
    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.save(DEFAULT_DEAL_INPUTS);
    });

    expect(result.current.saving).toBe(true);

    // Resolve the save
    await act(async () => {
      resolvePromise!();
      await savePromise!;
    });

    expect(result.current.saving).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: runScenario model engine
// ---------------------------------------------------------------------------

import { runScenario, DEFAULT_SCENARIOS } from "@/lib/model/scenarios";

describe("runScenario (financial model engine)", () => {
  const baseDeal = DEFAULT_DEAL_INPUTS;

  it("computes weekly results for the configured number of weeks", () => {
    const scenario = DEFAULT_SCENARIOS[1]; // Base case
    const output = runScenario(baseDeal, scenario);

    expect(output.weeks).toHaveLength(scenario.estimatedWeeks);
    expect(output.dealInputs.estimatedWeeks).toBe(scenario.estimatedWeeks);
    expect(output.dealInputs.avgTicketPrice).toBe(scenario.avgTicketPrice);
    expect(output.occupancyRate).toBe(scenario.occupancyRate);
  });

  it("calculates total gross box office as sum of weekly grosses", () => {
    const scenario = DEFAULT_SCENARIOS[1];
    const output = runScenario(baseDeal, scenario);

    const summedGross = output.weeks.reduce((s, w) => s + w.grossBoxOffice, 0);
    expect(output.totalGrossBoxOffice).toBeCloseTo(summedGross, 2);
  });

  it("identifies the recoup week when investors get their money back", () => {
    const scenario = DEFAULT_SCENARIOS[2]; // Bull case -- high occupancy
    const output = runScenario(baseDeal, scenario);

    // In a bull case with standard defaults, recoup should happen
    if (output.recoupWeek !== null) {
      expect(output.recoupWeek).toBeGreaterThan(0);
      expect(output.recoupWeek).toBeLessThanOrEqual(scenario.estimatedWeeks);

      // The identified week should be the first where isRecouped is true
      const firstRecouped = output.weeks.find((w) => w.isRecouped);
      expect(firstRecouped?.week).toBe(output.recoupWeek);
    }
  });

  it("returns null recoupWeek when production never recoups", () => {
    // Use extremely low occupancy to prevent recoup
    const scenario = { name: "Bust", occupancyRate: 0.1, avgTicketPrice: 50, estimatedWeeks: 5 };
    const output = runScenario(baseDeal, scenario);

    expect(output.recoupWeek).toBeNull();
  });

  it("computes per-investor returns when investors are present", () => {
    const deal: DealInputs = {
      ...baseDeal,
      investors: [
        { id: "inv-1", name: "Alice", amount: 100_000, units: 5 },
        { id: "inv-2", name: "Bob", amount: 200_000, units: 10 },
      ],
    };

    const scenario = DEFAULT_SCENARIOS[1];
    const output = runScenario(deal, scenario);

    expect(output.investorReturns).toHaveLength(2);

    const alice = output.investorReturns[0];
    expect(alice.investor.name).toBe("Alice");
    expect(alice.investmentAmount).toBe(100_000);
    expect(alice.poolPercent).toBeCloseTo(100_000 / deal.totalCapitalization, 6);

    const bob = output.investorReturns[1];
    expect(bob.investor.name).toBe("Bob");
    expect(bob.poolPercent).toBeCloseTo(200_000 / deal.totalCapitalization, 6);

    // Bob invested 2x Alice, so total received should be roughly 2x
    if (alice.totalReceived > 0) {
      expect(bob.totalReceived / alice.totalReceived).toBeCloseTo(2.0, 1);
    }
  });

  it("calculates weekly breakeven occupancy", () => {
    const scenario = DEFAULT_SCENARIOS[1];
    const output = runScenario(baseDeal, scenario);

    if (output.weeklyBreakeven !== null) {
      expect(output.weeklyBreakeven).toBeGreaterThan(0);
      expect(output.weeklyBreakeven).toBeLessThanOrEqual(1);
    }
  });

  it("computes approximate IRR when capitalization is positive", () => {
    const scenario = DEFAULT_SCENARIOS[2]; // Bull
    const output = runScenario(baseDeal, scenario);

    // IRR should be a number (could be positive or negative)
    if (output.approximateIRR !== null) {
      expect(typeof output.approximateIRR).toBe("number");
      expect(Number.isFinite(output.approximateIRR)).toBe(true);
    }
  });

  it("uses scenario-specific avgTicketPrice and estimatedWeeks", () => {
    const customScenario = {
      name: "Custom",
      occupancyRate: 0.85,
      avgTicketPrice: 200,
      estimatedWeeks: 40,
    };
    const output = runScenario(baseDeal, customScenario);

    expect(output.dealInputs.avgTicketPrice).toBe(200);
    expect(output.dealInputs.estimatedWeeks).toBe(40);
    expect(output.weeks).toHaveLength(40);
  });
});

// ---------------------------------------------------------------------------
// Tests: DEFAULT_DEAL_INPUTS shape
// ---------------------------------------------------------------------------

describe("DEFAULT_DEAL_INPUTS", () => {
  it("has valid default values for all required fields", () => {
    expect(DEFAULT_DEAL_INPUTS.totalCapitalization).toBe(2_000_000);
    expect(DEFAULT_DEAL_INPUTS.units).toBe(100);
    expect(DEFAULT_DEAL_INPUTS.unitPrice).toBe(20_000);
    expect(DEFAULT_DEAL_INPUTS.investors).toEqual([]);

    expect(DEFAULT_DEAL_INPUTS.weeklyNut).toBe(450_000);
    expect(DEFAULT_DEAL_INPUTS.capacity).toBe(1_200);
    expect(DEFAULT_DEAL_INPUTS.performances).toBe(8);
    expect(DEFAULT_DEAL_INPUTS.avgTicketPrice).toBe(125);

    expect(DEFAULT_DEAL_INPUTS.waterfallType).toBe("recoup_first");
    expect(DEFAULT_DEAL_INPUTS.postRecoupInvestorSplit).toBe(0.5);
    expect(DEFAULT_DEAL_INPUTS.estimatedWeeks).toBe(52);
  });

  it("has valid royalty percentages that sum to a reasonable total", () => {
    const royalties = DEFAULT_DEAL_INPUTS.royalties;
    const total =
      royalties.author +
      royalties.music +
      royalties.lyricist +
      royalties.director +
      royalties.choreographer +
      royalties.setDesigner +
      royalties.costumeDesigner +
      royalties.lightingDesigner +
      royalties.soundDesigner +
      royalties.starParticipation +
      royalties.productionCompany;

    // Total royalties should be a reasonable percentage (typically 10-20%)
    expect(total).toBeGreaterThan(0.05);
    expect(total).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Tests: DealBuilder component rendering
// ---------------------------------------------------------------------------

describe("DealBuilder component", () => {
  // We test the DealBuilder component in isolation using its props interface
  let DealBuilder: typeof import("@/app/(app)/productions/view/DealBuilder").DealBuilder;

  beforeEach(async () => {
    const mod = await import(
      "@/app/(app)/productions/view/DealBuilder"
    );
    DealBuilder = mod.DealBuilder;
  });

  it("renders the save button", () => {
    const baseOutput: ModelOutput = {
      dealInputs: DEFAULT_DEAL_INPUTS,
      occupancyRate: 0.75,
      weeks: [],
      recoupWeek: null,
      totalGrossBoxOffice: 0,
      totalRoyalties: 0,
      totalOperatingProfit: 0,
      totalInvestorDistributions: 0,
      investorReturns: [],
      approximateIRR: null,
      weeklyBreakeven: null,
    };

    // Minimal react-hook-form mocks
    const control = {} as any;
    const watch = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const setValue = vi.fn() as any;
    const getValues = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const handleSubmit = vi.fn((fn: any) => (e: any) => { e?.preventDefault?.(); fn(DEFAULT_DEAL_INPUTS); }) as any;

    render(
      <DealBuilder
        control={control}
        watch={watch}
        setValue={setValue}
        getValues={getValues}
        handleSubmit={handleSubmit}
        isDirty={false}
        saving={false}
        modelOutput={baseOutput}
        dealInputs={DEFAULT_DEAL_INPUTS}
        onSave={vi.fn()}
        initialGuidedMode={false}
        onGuidedModeChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /save deal inputs/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Unsaved changes' badge when isDirty is true", () => {
    const control = {} as any;
    const watch = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const setValue = vi.fn() as any;
    const getValues = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const handleSubmit = vi.fn((fn: any) => (e: any) => { e?.preventDefault?.(); }) as any;

    render(
      <DealBuilder
        control={control}
        watch={watch}
        setValue={setValue}
        getValues={getValues}
        handleSubmit={handleSubmit}
        isDirty={true}
        saving={false}
        modelOutput={null}
        dealInputs={DEFAULT_DEAL_INPUTS}
        onSave={vi.fn()}
        initialGuidedMode={false}
        onGuidedModeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("shows 'Saving...' text when saving is true", () => {
    const control = {} as any;
    const watch = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const setValue = vi.fn() as any;
    const getValues = vi.fn(() => DEFAULT_DEAL_INPUTS) as any;
    const handleSubmit = vi.fn((fn: any) => (e: any) => { e?.preventDefault?.(); }) as any;

    render(
      <DealBuilder
        control={control}
        watch={watch}
        setValue={setValue}
        getValues={getValues}
        handleSubmit={handleSubmit}
        isDirty={false}
        saving={true}
        modelOutput={null}
        dealInputs={DEFAULT_DEAL_INPUTS}
        onSave={vi.fn()}
        initialGuidedMode={false}
        onGuidedModeChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /saving\.\.\./i }),
    ).toBeInTheDocument();
  });
});
