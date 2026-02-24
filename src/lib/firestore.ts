import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Production } from "@/types/production";
import type { DealInputs } from "@/types/deal";
import type { Scenario } from "@/types/model";
import type { CapitalizationInvestor, ProducerPool } from "@/types/capitalization";
import type { DealRoom, CreateDealRoomPayload, UpdateDealRoomPayload } from "@/types/dealRoom";

// ─── Productions ────────────────────────────────────────────────────────────

export function subscribeToProductions(
  userId: string,
  callback: (productions: Production[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "productions"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const productions = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      } as Production;
    });
    callback(productions);
  });
}

export async function getProduction(productionId: string): Promise<Production | null> {
  const ref = doc(db, "productions", productionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
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
  const ref = await addDoc(collection(db, "productions"), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduction(
  productionId: string,
  data: Partial<Omit<Production, "id" | "userId" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "productions", productionId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduction(productionId: string): Promise<void> {
  await deleteDoc(doc(db, "productions", productionId));
}

// ─── Deal Inputs ─────────────────────────────────────────────────────────────

export async function getDealInputs(productionId: string): Promise<DealInputs | null> {
  const ref = doc(db, "productions", productionId, "dealInputs", "primary");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DealInputs;
}

// Firestore rejects documents containing `undefined` values.
// This strips them recursively while preserving Firestore sentinels (serverTimestamp, etc.)
function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  // Firestore sentinel objects have a special toJSON / type shape — don't recurse into them
  if ("_methodName" in (obj as object)) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  ) as T;
}

export async function saveDealInputs(
  productionId: string,
  inputs: DealInputs
): Promise<void> {
  const ref = doc(db, "productions", productionId, "dealInputs", "primary");
  const payload = stripUndefined({ ...inputs, updatedAt: serverTimestamp() });
  await setDoc(ref, payload, { merge: true });
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
    const ref = doc(db, "productions", productionId, "scenarios", scenario.id);
    await setDoc(ref, scenario, { merge: true });
    return scenario.id;
  } else {
    const ref = await addDoc(
      collection(db, "productions", productionId, "scenarios"),
      scenario
    );
    return ref.id;
  }
}

export async function deleteScenario(
  productionId: string,
  scenarioId: string
): Promise<void> {
  await deleteDoc(
    doc(db, "productions", productionId, "scenarios", scenarioId)
  );
}

// ─── Capitalization Investors ──────────────────────────────────────────────────

export function subscribeToInvestors(
  productionId: string,
  callback: (investors: CapitalizationInvestor[]) => void
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
  });
}

export async function createInvestor(
  productionId: string,
  data: Omit<CapitalizationInvestor, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const payload = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const ref = await addDoc(
    collection(db, "productions", productionId, "investors"),
    payload
  );
  return ref.id;
}

export async function updateInvestor(
  productionId: string,
  investorId: string,
  data: Partial<Omit<CapitalizationInvestor, "id" | "productionId" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "productions", productionId, "investors", investorId);
  const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
  await updateDoc(ref, payload);
}

export async function deleteInvestor(
  productionId: string,
  investorId: string
): Promise<void> {
  await deleteDoc(doc(db, "productions", productionId, "investors", investorId));
}

// ─── Producer Pools ──────────────────────────────────────────────────────────

export function subscribeToProducerPools(
  productionId: string,
  callback: (pools: ProducerPool[]) => void
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
  });
}

export async function createProducerPool(
  productionId: string,
  data: Omit<ProducerPool, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const payload = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const ref = await addDoc(
    collection(db, "productions", productionId, "producerPools"),
    payload
  );
  return ref.id;
}

export async function updateProducerPool(
  productionId: string,
  poolId: string,
  data: Partial<Omit<ProducerPool, "id" | "productionId" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "productions", productionId, "producerPools", poolId);
  const payload = stripUndefined({ ...data, updatedAt: serverTimestamp() });
  await updateDoc(ref, payload);
}

export async function deleteProducerPool(
  productionId: string,
  poolId: string
): Promise<void> {
  await deleteDoc(doc(db, "productions", productionId, "producerPools", poolId));
}

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
    const defaultPool = snap.docs.find((d) => d.data().name === "Direct Investors");
    return defaultPool?.id ?? snap.docs[0].id;
  }
  return createProducerPool(productionId, {
    productionId,
    ownerUserId,
    name: "Direct Investors",
  });
}

export async function assignInvestorsToDefaultPool(
  productionId: string,
  poolId: string
): Promise<void> {
  const snap = await getDocs(
    collection(db, "productions", productionId, "investors")
  );
  const updates: Promise<void>[] = [];
  for (const d of snap.docs) {
    if (!d.data().producerPoolId) {
      updates.push(updateDoc(d.ref, { producerPoolId: poolId }));
    }
  }
  await Promise.all(updates);
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
 * Creates a new deal room. The token (document ID) is auto-generated by Firestore.
 * Returns the token string.
 */
export async function createDealRoom(
  payload: CreateDealRoomPayload
): Promise<string> {
  const ref = await addDoc(
    collection(db, "dealRooms"),
    stripUndefined({
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

/**
 * Fetches a deal room by token (document ID).
 * Returns null if the document doesn't exist or is inactive.
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
 * Only the owning producer can call this — enforced by Firestore security rules.
 */
export async function updateDealRoom(
  token: string,
  data: UpdateDealRoomPayload
): Promise<void> {
  const ref = doc(db, "dealRooms", token);
  await updateDoc(ref, stripUndefined({ ...data, updatedAt: serverTimestamp() }));
}

/**
 * Deactivates a deal room — sets isActive = false.
 * The URL will stop working immediately (Firestore rule blocks read when isActive = false).
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
  return snap.docs.map((d) =>
    hydrateDealRoom(d.id, d.data() as Record<string, unknown>)
  );
}
