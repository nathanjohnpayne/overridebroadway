import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "./firebase";
import { createRecord, mutate } from "./mutations";
import type { Production } from "@/types/production";
import type { DealInputs } from "@/types/deal";
import type { Scenario } from "@/types/model";
import type { CapitalizationInvestor, ProducerPool } from "@/types/capitalization";
import type { DealRoom, CreateDealRoomPayload, UpdateDealRoomPayload } from "@/types/dealRoom";

// ─── Listeners ──────────────────────────────────────────────────────────────

// Fallback error handler so a failed listener is never silent.
function logSnapshotError(label: string) {
  return (error: FirestoreError) => {
    console.error(`Firestore listener for ${label} failed:`, error);
  };
}

// ─── Productions ────────────────────────────────────────────────────────────

export function subscribeToProductions(
  userId: string,
  callback: (productions: Production[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, "productions"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const productions = snap.docs.filter((d) => !d.data().deleted).map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      } as Production;
    });
    callback(productions);
  }, onError ?? logSnapshotError("productions"));
}

export async function getProduction(productionId: string): Promise<Production | null> {
  const ref = doc(db, "productions", productionId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().deleted || snap.data().deleting) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  } as Production;
}

export async function createProduction(
  userId: string,
  data: Omit<Production, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createRecord("productions", { ...data, userId });
}

export async function updateProduction(
  productionId: string,
  data: Partial<Omit<Production, "id" | "userId" | "createdAt">>
): Promise<void> {
  await mutate({ action: "update", collection: "productions", id: productionId, data });
}

/** Fence writes, retire share tokens, and clean up through the trusted backend. */
export async function deleteProduction(productionId: string, ownerUserId: string): Promise<void> {
  void ownerUserId; // The backend derives ownership from the authenticated caller.
  await mutate({ action: "deleteProduction", productionId });
}

// ─── Deal Inputs ─────────────────────────────────────────────────────────────

export async function getDealInputs(productionId: string): Promise<DealInputs | null> {
  const ref = doc(db, "productions", productionId, "dealInputs", "primary");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DealInputs;
}

export async function saveDealInputs(
  productionId: string,
  inputs: DealInputs
): Promise<void> {
  await mutate({ action: "set", collection: "dealInputs", productionId, id: "primary", data: inputs });
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export async function getScenarios(productionId: string): Promise<Scenario[]> {
  const snap = await getDocs(
    collection(db, "productions", productionId, "scenarios")
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario));
}

export async function saveScenario(
  productionId: string,
  scenario: Scenario
): Promise<string> {
  if (scenario.id) {
    await mutate({ action: "set", collection: "scenarios", productionId, id: scenario.id, data: scenario });
    return scenario.id;
  }
  return createRecord("scenarios", scenario, productionId);
}

export async function deleteScenario(
  productionId: string,
  scenarioId: string
): Promise<void> {
  await mutate({ action: "delete", collection: "scenarios", productionId, id: scenarioId });
}

// ─── Capitalization Investors ──────────────────────────────────────────────────

export function subscribeToInvestors(
  productionId: string,
  callback: (investors: CapitalizationInvestor[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, "productions", productionId, "investors"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const investors = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as CapitalizationInvestor;
    });
    callback(investors);
  }, onError ?? logSnapshotError("investors"));
}

export async function createInvestor(
  productionId: string,
  data: Omit<CapitalizationInvestor, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createRecord("investors", data, productionId);
}

export async function updateInvestor(
  productionId: string,
  investorId: string,
  data: Partial<Omit<CapitalizationInvestor, "id" | "productionId" | "createdAt">>
): Promise<void> {
  await mutate({ action: "update", collection: "investors", productionId, id: investorId, data });
}

export async function deleteInvestor(
  productionId: string,
  investorId: string
): Promise<void> {
  await mutate({ action: "delete", collection: "investors", productionId, id: investorId });
}

// ─── Producer Pools ──────────────────────────────────────────────────────────

export function subscribeToProducerPools(
  productionId: string,
  callback: (pools: ProducerPool[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, "productions", productionId, "producerPools"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const pools = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as ProducerPool;
    });
    callback(pools);
  }, onError ?? logSnapshotError("producerPools"));
}

export async function createProducerPool(
  productionId: string,
  data: Omit<ProducerPool, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createRecord("producerPools", data, productionId);
}

export async function updateProducerPool(
  productionId: string,
  poolId: string,
  data: Partial<Omit<ProducerPool, "id" | "productionId" | "createdAt">>
): Promise<void> {
  await mutate({ action: "update", collection: "producerPools", productionId, id: poolId, data });
}

export async function deleteProducerPool(
  productionId: string,
  poolId: string
): Promise<void> {
  await mutate({ action: "delete", collection: "producerPools", productionId, id: poolId });
}

/**
 * Fixed document id for the "Direct Investors" default pool. A deterministic
 * id makes creation idempotent: concurrent bootstraps (two tabs, React
 * StrictMode double effects) converge on one document instead of racing to
 * create duplicates.
 */
export const DEFAULT_POOL_ID = "direct";
export const DEFAULT_POOL_NAME = "Direct Investors";

// Lazy migration: ensure a "Direct Investors" default pool exists and
// assign any legacy investors (no producerPoolId) to it.
export async function ensureDefaultPool(
  productionId: string,
  ownerUserId: string
): Promise<string> {
  const snap = await getDocs(
    collection(db, "productions", productionId, "producerPools")
  );
  if (!snap.empty) {
    // Legacy productions created their default pool with an auto-generated
    // id; keep using it so existing investor assignments stay valid.
    const defaultPool =
      snap.docs.find((d) => d.id === DEFAULT_POOL_ID) ??
      snap.docs.find((d) => d.data().name === DEFAULT_POOL_NAME);
    return defaultPool?.id ?? snap.docs[0].id;
  }
  await mutate({
    action: "ensure", collection: "producerPools", productionId, id: DEFAULT_POOL_ID,
    data: { productionId, ownerUserId, name: DEFAULT_POOL_NAME },
  });
  return DEFAULT_POOL_ID;
}

export async function assignInvestorsToDefaultPool(
  productionId: string,
  poolId: string
): Promise<void> {
  await mutate({ action: "assignDefaultPool", productionId, id: poolId });
}

// ─── Deal Rooms ───────────────────────────────────────────────────────────────

/**
 * Converts Firestore Timestamp fields to JS Dates on a DealRoom document.
 */
function hydrateDealRoom(id: string, data: Record<string, unknown>): DealRoom {
  return {
    id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : new Date(),
    expiresAt: data.expiresAt instanceof Timestamp
      ? data.expiresAt.toDate()
      : undefined,
  } as DealRoom;
}

/**
 * Creates a new deal room through the `mutate` callable. The token (document ID)
 * is generated by the backend (`randomUUID()` in `functions/src/service.cjs`).
 * Returns the token string.
 */
export async function createDealRoom(
  payload: CreateDealRoomPayload
): Promise<string> {
  return createRecord("dealRooms", payload);
}

/**
 * Fetches a deal room by token (document ID).
 * Returns null if the document doesn't exist.
 *
 * Security rules allow the read when the room is active or the caller owns
 * it; otherwise the read rejects with `permission-denied` (for investors,
 * that means the producer deactivated the link).
 * NOTE: This function can be called without auth — used by the investor-facing route.
 */
export async function getDealRoom(token: string): Promise<DealRoom | null> {
  const ref = doc(db, "dealRooms", token);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return hydrateDealRoom(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Updates an existing deal room (config, isActive, snapshot refresh, etc.).
 * Only the owning producer can update a room — enforced by the `mutate` backend
 * (Firestore rules deny all client writes).
 */
export async function updateDealRoom(
  token: string,
  data: UpdateDealRoomPayload
): Promise<void> {
  await mutate({ action: "update", collection: "dealRooms", id: token, data });
}

/**
 * Deactivates a deal room — sets isActive = false.
 * The URL stops working immediately for everyone except the owner
 * (Firestore rules only allow non-owners to read active rooms).
 */
export async function deactivateDealRoom(token: string): Promise<void> {
  await updateDealRoom(token, { isActive: false });
}

/**
 * Fetches all deal rooms owned by a user for a specific production.
 * Ordered by creation time descending (most recent first).
 */
export async function getProductionDealRooms(
  productionId: string,
  ownedByUserId: string
): Promise<DealRoom[]> {
  const q = query(
    collection(db, "dealRooms"),
    where("productionId", "==", productionId),
    where("ownedByUserId", "==", ownedByUserId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => !d.data().retired).map((d) =>
    hydrateDealRoom(d.id, d.data() as Record<string, unknown>)
  );
}
