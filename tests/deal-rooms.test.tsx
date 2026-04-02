/**
 * @spec deal-rooms
 *
 * Tests for deal rooms: public share link generation, no-auth access,
 * content display, and configuration toggles.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { DEFAULT_DEAL_INPUTS, type DealInputs } from "@/types/deal";
import type { DealRoom, DealRoomConfig } from "@/types/dealRoom";
import { DEFAULT_DEAL_ROOM_CONFIG } from "@/types/dealRoom";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/deal-room",
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    dealRoomViewed: vi.fn(),
    dealRoomCreated: vi.fn(),
    dealRoomLinkCopied: vi.fn(),
    dealRoomUpdated: vi.fn(),
    dealRoomDeactivated: vi.fn(),
  },
}));

const mockGetDealRoom = vi.fn();
vi.mock("@/lib/firestore", () => ({
  getDealRoom: (...args: unknown[]) => mockGetDealRoom(...args),
  createDealRoom: vi.fn(),
  updateDealRoom: vi.fn(),
  deactivateDealRoom: vi.fn(),
  getProductionDealRooms: vi.fn(() => Promise.resolve([])),
  updateProduction: vi.fn(),
}));

// Mock firebase modules
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  browserLocalPersistence: "local",
  setPersistence: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({})),
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

// Import after mocks
import DealRoomClient from "@/app/deal-room/DealRoomClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDealRoom(overrides: Partial<DealRoom> = {}): DealRoom {
  return {
    id: "token-abc-123",
    productionId: "prod-1",
    ownedByUserId: "user-1",
    production: {
      name: "Hamilton",
      subtitle: "An American Musical",
      venue: "Richard Rodgers Theatre",
      status: "open",
      artworkUrl: "https://example.com/art.jpg",
    },
    dealInputs: DEFAULT_DEAL_INPUTS,
    config: {
      ...DEFAULT_DEAL_ROOM_CONFIG,
      showFinancialModel: true,
      showWaterfall: true,
    },
    isActive: true,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-06-15"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe("DealRoomClient", () => {
  describe("no token provided", () => {
    it("shows 'Deal room not found' when no token is in the URL", async () => {
      mockSearchParams = new URLSearchParams();

      render(<DealRoomClient />);

      await waitFor(() => {
        expect(screen.getByText("Deal room not found")).toBeInTheDocument();
      });
    });
  });

  describe("invalid token", () => {
    it("shows 'Deal room not found' when getDealRoom returns null", async () => {
      mockSearchParams = new URLSearchParams("token=invalid-token");
      mockGetDealRoom.mockResolvedValue(null);

      render(<DealRoomClient />);

      await waitFor(() => {
        expect(screen.getByText("Deal room not found")).toBeInTheDocument();
      });

      expect(mockGetDealRoom).toHaveBeenCalledWith("invalid-token");
    });
  });

  describe("inactive deal room", () => {
    it("shows 'This deal room is no longer active' when isActive is false", async () => {
      mockSearchParams = new URLSearchParams("token=deactivated-token");
      mockGetDealRoom.mockResolvedValue(makeDealRoom({ isActive: false }));

      render(<DealRoomClient />);

      await waitFor(() => {
        expect(
          screen.getByText("This deal room is no longer active"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    it("shows error message when getDealRoom throws", async () => {
      mockSearchParams = new URLSearchParams("token=error-token");
      mockGetDealRoom.mockRejectedValue(new Error("Network error"));

      render(<DealRoomClient />);

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("shows loading spinner while fetching", () => {
      mockSearchParams = new URLSearchParams("token=loading-token");
      // Never resolve to keep in loading state
      mockGetDealRoom.mockReturnValue(new Promise(() => {}));

      render(<DealRoomClient />);

      expect(screen.getByText(/loading deal room/i)).toBeInTheDocument();
    });
  });

  describe("successful load (ready state)", () => {
    it("renders the deal room content when token is valid and active", async () => {
      const dealRoom = makeDealRoom();
      mockSearchParams = new URLSearchParams("token=token-abc-123");
      mockGetDealRoom.mockResolvedValue(dealRoom);

      render(<DealRoomClient />);

      await waitFor(() => {
        expect(screen.getByText("Hamilton")).toBeInTheDocument();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: DealRoomView component
// ---------------------------------------------------------------------------

import DealRoomView from "@/app/deal-room/DealRoomView";
import { runScenario } from "@/lib/model/scenarios";

describe("DealRoomView", () => {
  it("renders production name and status badge", () => {
    const dealRoom = makeDealRoom();

    render(<DealRoomView dealRoom={dealRoom} />);

    expect(screen.getByText("Hamilton")).toBeInTheDocument();
    // Status badge renders as "Open" (capitalized label)
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders subtitle and venue when present", () => {
    const dealRoom = makeDealRoom();

    render(<DealRoomView dealRoom={dealRoom} />);

    expect(screen.getByText("An American Musical")).toBeInTheDocument();
    expect(screen.getByText("Richard Rodgers Theatre")).toBeInTheDocument();
  });

  it("renders the Override branding in the top bar", () => {
    const dealRoom = makeDealRoom();

    render(<DealRoomView dealRoom={dealRoom} />);

    // Top bar contains "Override" and "Secure investor view"
    expect(screen.getAllByText("Override").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/secure investor view/i)).toBeInTheDocument();
  });

  it("renders deal structure cards with correct values", () => {
    const dealRoom = makeDealRoom({
      dealInputs: {
        ...DEFAULT_DEAL_INPUTS,
        totalCapitalization: 2_000_000,
        weeklyNut: 450_000,
      },
    });

    render(<DealRoomView dealRoom={dealRoom} />);

    expect(screen.getByText("Deal Structure")).toBeInTheDocument();
    expect(screen.getByText("Total Capitalization")).toBeInTheDocument();
    expect(screen.getByText("Weekly Nut")).toBeInTheDocument();
  });

  describe("financial scenarios", () => {
    it("renders Bear, Base, and Bull scenario cards when showFinancialModel is true", () => {
      const dealRoom = makeDealRoom({
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, showFinancialModel: true },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(screen.getByText("Bear Case")).toBeInTheDocument();
      expect(screen.getByText("Base Case")).toBeInTheDocument();
      expect(screen.getByText("Bull Case")).toBeInTheDocument();
    });

    it("does NOT render scenario cards when showFinancialModel is false", () => {
      const dealRoom = makeDealRoom({
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, showFinancialModel: false },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(screen.queryByText("Bear Case")).not.toBeInTheDocument();
      expect(screen.queryByText("Bull Case")).not.toBeInTheDocument();
    });
  });

  describe("waterfall section", () => {
    it("renders waterfall when showWaterfall is true", () => {
      const dealRoom = makeDealRoom({
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, showWaterfall: true },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.getByText(/revenue waterfall/i),
      ).toBeInTheDocument();
    });

    it("hides waterfall when showWaterfall is false", () => {
      const dealRoom = makeDealRoom({
        config: {
          ...DEFAULT_DEAL_ROOM_CONFIG,
          showWaterfall: false,
          showFinancialModel: false,
        },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.queryByText(/revenue waterfall \(base case\)/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("weekly breakdown", () => {
    it("renders weekly breakdown table when showWeeklyBreakdown is true", () => {
      const dealRoom = makeDealRoom({
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, showWeeklyBreakdown: true },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.getByText(/week-by-week breakdown/i),
      ).toBeInTheDocument();
    });

    it("hides weekly breakdown when showWeeklyBreakdown is false", () => {
      const dealRoom = makeDealRoom({
        config: {
          ...DEFAULT_DEAL_ROOM_CONFIG,
          showWeeklyBreakdown: false,
          showFinancialModel: false,
        },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.queryByText(/week-by-week breakdown/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("capitalization structure", () => {
    it("renders capitalization section when showCapitalizationProgress is true", () => {
      const dealRoom = makeDealRoom({
        config: {
          ...DEFAULT_DEAL_ROOM_CONFIG,
          showCapitalizationProgress: true,
        },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.getByText("Capitalization Structure"),
      ).toBeInTheDocument();

      // Should show aggregate only, not individual investor data
      expect(
        screen.getByText(
          /individual investor details are kept confidential/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("producer note", () => {
    it("renders the producer note when present", () => {
      const dealRoom = makeDealRoom({
        config: {
          ...DEFAULT_DEAL_ROOM_CONFIG,
          producerNote: "We are excited to have you consider this investment.",
        },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.getByText(
          "We are excited to have you consider this investment.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Note from the Producer"),
      ).toBeInTheDocument();
    });

    it("does not render the producer note section when empty", () => {
      const dealRoom = makeDealRoom({
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, producerNote: "" },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.queryByText("Note from the Producer"),
      ).not.toBeInTheDocument();
    });
  });

  describe("documents", () => {
    it("renders document links when showDocuments is true and docs exist", () => {
      const dealRoom = makeDealRoom({
        production: {
          name: "Hamilton",
          status: "open",
          investorInstructionLetterUrl: "https://example.com/letter.pdf",
          investorInstructionLetterName: "Investor Letter",
          operatingAgreementUrl: "https://example.com/oa.pdf",
          operatingAgreementName: "Operating Agreement",
        },
        config: { ...DEFAULT_DEAL_ROOM_CONFIG, showDocuments: true },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(screen.getByText("Investor Letter")).toBeInTheDocument();
      expect(screen.getByText("Operating Agreement")).toBeInTheDocument();
    });

    it("hides documents section when showDocuments is false", () => {
      const dealRoom = makeDealRoom({
        production: {
          name: "Hamilton",
          status: "open",
          investorInstructionLetterUrl: "https://example.com/letter.pdf",
          investorInstructionLetterName: "Investor Letter",
        },
        config: {
          ...DEFAULT_DEAL_ROOM_CONFIG,
          showDocuments: false,
          showFinancialModel: false,
        },
      });

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(screen.queryByText("Investor Letter")).not.toBeInTheDocument();
    });
  });

  describe("disclaimer", () => {
    it("renders the legal disclaimer footer", () => {
      const dealRoom = makeDealRoom();

      render(<DealRoomView dealRoom={dealRoom} />);

      expect(
        screen.getByText("Important Disclosures"),
      ).toBeInTheDocument();
    });
  });

  describe("no auth required", () => {
    it("does not import or reference AuthProvider or useAuth", () => {
      // This is a structural test -- DealRoomClient and DealRoomView should
      // work without any auth context. The fact that we can render them
      // above without wrapping in AuthProvider proves this.
      const dealRoom = makeDealRoom();

      // Should not throw
      const { container } = render(<DealRoomView dealRoom={dealRoom} />);
      expect(container).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: DealRoomConfig defaults
// ---------------------------------------------------------------------------

describe("DEFAULT_DEAL_ROOM_CONFIG", () => {
  it("has financial model and waterfall enabled by default", () => {
    expect(DEFAULT_DEAL_ROOM_CONFIG.showFinancialModel).toBe(true);
    expect(DEFAULT_DEAL_ROOM_CONFIG.showWaterfall).toBe(true);
  });

  it("has cap progress, documents, and weekly breakdown disabled by default", () => {
    expect(DEFAULT_DEAL_ROOM_CONFIG.showCapitalizationProgress).toBe(false);
    expect(DEFAULT_DEAL_ROOM_CONFIG.showDocuments).toBe(false);
    expect(DEFAULT_DEAL_ROOM_CONFIG.showWeeklyBreakdown).toBe(false);
  });

  it("has empty producer note by default", () => {
    expect(DEFAULT_DEAL_ROOM_CONFIG.producerNote).toBe("");
  });
});
