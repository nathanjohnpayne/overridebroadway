/**
 * @spec deal-builder
 *
 * Tests for src/lib/firestore.ts listener error handling and the idempotent
 * "Direct Investors" default pool bootstrap.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockOnSnapshot,
  mockGetDocs,
  mockRunTransaction,
  mockDoc,
  txGet,
  txSet,
} = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockGetDocs: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockDoc: vi.fn((...segments: unknown[]) => ({ path: segments.slice(1).join("/") })),
  txGet: vi.fn(),
  txSet: vi.fn(),
}));

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn(() => Promise.resolve({})) }));
vi.mock("@/lib/mutations", () => ({ mutate: mockMutate, createRecord: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...segments: unknown[]) => ({ path: segments.slice(1).join("/") })),
  doc: mockDoc,
  getDocs: mockGetDocs,
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((c: unknown) => c),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  onSnapshot: mockOnSnapshot,
  writeBatch: vi.fn(),
  runTransaction: mockRunTransaction,
  Timestamp: class {},
}));

import {
  DEFAULT_POOL_ID,
  ensureDefaultPool,
  subscribeToInvestors,
  subscribeToProducerPools,
  subscribeToProductions,
} from "@/lib/firestore";

const onError = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockRunTransaction.mockImplementation(async (_db, fn) =>
    fn({ get: txGet, set: txSet }),
  );
});

describe("snapshot listeners", () => {
  it.each([
    ["productions", () => subscribeToProductions("user-1", vi.fn(), onError)],
    ["investors", () => subscribeToInvestors("prod-1", vi.fn(), onError)],
    ["producerPools", () => subscribeToProducerPools("prod-1", vi.fn(), onError)],
  ])("passes the caller's error handler for %s", (_label, subscribe) => {
    subscribe();
    const errorHandler = mockOnSnapshot.mock.calls[0][2];
    errorHandler(new Error("permission-denied"));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("always registers an error handler even when the caller passes none", () => {
    subscribeToProductions("user-1", vi.fn());
    expect(typeof mockOnSnapshot.mock.calls[0][2]).toBe("function");
  });
});

describe("ensureDefaultPool", () => {
  it("creates the default pool at a fixed id when none exists", async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    txGet.mockResolvedValue({ exists: () => false });

    const id = await ensureDefaultPool("prod-1", "user-1");

    expect(id).toBe(DEFAULT_POOL_ID);
    expect(mockMutate).toHaveBeenCalledWith({
      action: "ensure", collection: "producerPools", productionId: "prod-1", id: DEFAULT_POOL_ID,
      data: { productionId: "prod-1", ownerUserId: "user-1", name: "Direct Investors" },
    });
  });

  it("does not overwrite a pool created concurrently", async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    txGet.mockResolvedValue({ exists: () => true });

    const id = await ensureDefaultPool("prod-1", "user-1");

    expect(id).toBe(DEFAULT_POOL_ID);
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ action: "ensure", id: DEFAULT_POOL_ID }));
  });

  it("keeps using a legacy auto-id Direct Investors pool", async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [
        { id: "other", data: () => ({ name: "Syndicate A" }) },
        { id: "legacy-auto-id", data: () => ({ name: "Direct Investors" }) },
      ],
    });

    const id = await ensureDefaultPool("prod-1", "user-1");

    expect(id).toBe("legacy-auto-id");
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
