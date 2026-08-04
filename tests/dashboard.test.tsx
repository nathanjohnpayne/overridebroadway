/**
 * @spec dashboard
 *
 * Tests for the dashboard: production list rendering, loading/empty states,
 * navigation, creation dialog, and deletion flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { Production, ProductionStatus } from "@/types/production";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPush, mockUseSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: mockUseSearchParams,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    productionCreated: vi.fn(),
  },
}));

// Mock firestore functions
const mockCreateProduction = vi.fn();
const mockDeleteProduction = vi.fn();
vi.mock("@/lib/firestore", () => ({
  createProduction: (...args: unknown[]) => mockCreateProduction(...args),
  deleteProduction: (...args: unknown[]) => mockDeleteProduction(...args),
  subscribeToProductions: vi.fn(),
}));

// Mock useProductions hook
const mockProductions: Production[] = [];
let mockLoading = false;
vi.mock("@/hooks/useProductions", () => ({
  useProductions: () => ({ productions: mockProductions, loading: mockLoading }),
}));

// Mock useAuth
const mockUser = { uid: "user-1", email: "test@example.com", displayName: "Test" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement("img", props),
}));

// Import after mocks
import DashboardPage from "@/app/(app)/dashboard/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduction(overrides: Partial<Production> = {}): Production {
  return {
    id: "prod-1",
    userId: "user-1",
    name: "Hamilton",
    subtitle: "An American Musical",
    venue: "Richard Rodgers Theatre",
    status: "open" as ProductionStatus,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-15"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPush.mockReset();
  // Reset module-level state by reassigning mockProductions contents
  mockProductions.length = 0;
  mockLoading = false;
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
});

describe("DashboardPage", () => {
  describe("loading state", () => {
    it("renders skeleton placeholders while loading", () => {
      mockLoading = true;

      render(<DashboardPage />);

      // The dashboard renders 3 skeleton cards during loading
      // Skeletons use the .h-48 class and are in a grid
      const skeletons = document.querySelectorAll(".animate-pulse, [class*='skeleton']");
      expect(skeletons.length).toBeGreaterThan(0);
      // We should see placeholder content (no production cards)
      expect(screen.queryByText("Hamilton")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows the empty state when no productions exist", () => {
      mockProductions.length = 0;
      mockLoading = false;

      render(<DashboardPage />);

      expect(screen.getByText("No productions yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Create your first production to start modeling its deal structure.",
        ),
      ).toBeInTheDocument();
      // Both the header and the empty state offer creation, so this
      // assertion deliberately checks both accessible actions.
      expect(
        screen.getAllByRole("button", { name: /^new production$/i }),
      ).toHaveLength(2);
    });

    it("shows the investments empty state when no personal investments exist", async () => {
      mockProductions.length = 0;
      mockLoading = false;

      // The page reads the mock at render time, so configure the
      // function itself rather than mutating an imported module
      // namespace after it has been captured by the page module.
      mockUseSearchParams.mockReturnValue(new URLSearchParams("view=investments"));
      render(<DashboardPage />);

      expect(await screen.findByText("No personal investments tracked")).toBeInTheDocument();
    });
  });

  describe("production list rendering", () => {
    it("renders production cards with name, status badge, and date", () => {
      mockProductions.push(
        makeProduction({
          id: "p1",
          name: "Hamilton",
          status: "open",
          updatedAt: new Date("2025-06-15"),
        }),
        makeProduction({
          id: "p2",
          name: "Wicked",
          status: "development",
          venue: "Gershwin Theatre",
          updatedAt: new Date("2025-07-01"),
        }),
      );
      mockLoading = false;

      render(<DashboardPage />);

      expect(screen.getByText("Hamilton")).toBeInTheDocument();
      expect(screen.getByText("Wicked")).toBeInTheDocument();
      expect(screen.getByText("open")).toBeInTheDocument();
      expect(screen.getByText("development")).toBeInTheDocument();
    });

    it("shows the production count in the header", () => {
      mockProductions.push(
        makeProduction({ id: "p1", name: "Show 1" }),
        makeProduction({ id: "p2", name: "Show 2" }),
        makeProduction({ id: "p3", name: "Show 3" }),
      );
      mockLoading = false;

      render(<DashboardPage />);

      expect(
        screen.getByText("3 productions in your portfolio"),
      ).toBeInTheDocument();
    });

    it("shows singular 'production' when only one exists", () => {
      mockProductions.push(makeProduction({ id: "p1" }));
      mockLoading = false;

      render(<DashboardPage />);

      expect(
        screen.getByText("1 production in your portfolio"),
      ).toBeInTheDocument();
    });

    it("renders subtitle and venue when present", () => {
      mockProductions.push(
        makeProduction({
          name: "Hamilton",
          subtitle: "An American Musical",
          venue: "Richard Rodgers Theatre",
        }),
      );

      render(<DashboardPage />);

      expect(screen.getByText("An American Musical")).toBeInTheDocument();
      expect(screen.getByText("Richard Rodgers Theatre")).toBeInTheDocument();
    });

    it("renders a gradient placeholder when no artwork URL is set", () => {
      mockProductions.push(makeProduction({ artworkUrl: undefined }));
      mockLoading = false;

      render(<DashboardPage />);

      // The placeholder div contains a theater mask emoji
      expect(screen.getByText("🎭")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("wraps each production card in a link to the detail page", () => {
      mockProductions.push(makeProduction({ id: "abc123" }));
      mockLoading = false;

      render(<DashboardPage />);

      const link = screen.getByRole("link", { name: /hamilton/i });
      expect(link).toHaveAttribute("href", "/productions/view?id=abc123");
    });
  });

  describe("create production", () => {
    it("opens a dialog with form fields when 'New Production' is clicked", async () => {
      const user = userEvent.setup();
      mockLoading = false;

      render(<DashboardPage />);

      // Click the header-level "New Production" button
      const buttons = screen.getAllByRole("button", { name: /new production/i });
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByLabelText(/production name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/subtitle/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/venue/i)).toBeInTheDocument();
      });
    });

    it("calls createProduction and redirects on successful creation", async () => {
      const user = userEvent.setup();
      mockCreateProduction.mockResolvedValue("new-prod-id");
      mockLoading = false;

      render(<DashboardPage />);

      const buttons = screen.getAllByRole("button", { name: /new production/i });
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByLabelText(/production name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/production name/i), "New Show");
      await user.click(
        screen.getByRole("button", { name: /create production/i }),
      );

      await waitFor(() => {
        expect(mockCreateProduction).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({ name: "New Show" }),
        );
        expect(mockPush).toHaveBeenCalledWith(
          "/productions/view?id=new-prod-id&new=1",
        );
      });
    });
  });

  describe("delete production", () => {
    it("calls deleteProduction when confirmed", async () => {
      const user = userEvent.setup();
      mockDeleteProduction.mockResolvedValue(undefined);
      mockProductions.push(makeProduction({ id: "del-1", name: "Doomed Show" }));
      mockLoading = false;

      render(<DashboardPage />);

      // The delete button is inside a dropdown menu on the card
      // Find the three-dot button and click it
      const moreButton = screen.getByRole("button", { name: "" });
      await user.click(moreButton);

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: /delete production/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("menuitem", { name: /delete production/i }),
      );

      // Confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /^delete$/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(mockDeleteProduction).toHaveBeenCalledWith("del-1");
      });
    });
  });
});
