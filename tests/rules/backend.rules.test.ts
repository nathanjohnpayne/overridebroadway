/** @spec resource-quotas */
import { createRequire } from "node:module";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { createService } = require("./src/service.cjs");
let env: RulesTestEnvironment;
let app: ReturnType<typeof initializeApp>;
let db: ReturnType<typeof getFirestore>;
let time: number;
let service: (uid: string, input: object) => Promise<{id: string; path: string}>;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-overridebroadway" });
  app = initializeApp({ projectId: "demo-overridebroadway" }, "backend-test");
  db = getFirestore(app);
});
afterAll(async () => { await env.cleanup(); await deleteApp(app); });
beforeEach(async () => {
  await env.clearFirestore();
  time = 1800000000000;
  service = createService({ db, Timestamp, FieldValue, HttpsError, now: () => time,
    bucket: { file: () => ({ delete: async () => {} }) } });
  await db.doc("productions/alice-prod").set({ userId: "alice", name: "Alice" });
  await db.doc("productions/bob-prod").set({ userId: "bob", name: "Bob" });
});
const room = { productionId: "alice-prod", ownedByUserId: "alice", production: { name: "Alice" }, dealInputs: { investors: [] }, config: { showDocuments: false }, isActive: true };

describe("trusted quota mutations", () => {
  it("serializes concurrent production allocations at the exact limit", async () => {
    const batch = db.batch();
    for (let i = 0; i < 18; i++) batch.set(db.doc(`productions/seed-${i}`), { userId: "alice" });
    await batch.commit();
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => service("alice", { action: "create", collection: "productions", data: { name: "New" } })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.collection("productions").where("userId", "==", "alice").get()).size).toBe(20);
  });
  it.each([["investors", 200], ["scenarios", 20], ["producerPools", 20]])("bounds %s allocations including legacy data", async (collection, limit) => {
    const batch = db.batch();
    for (let i = 0; i < Number(limit); i++) batch.set(db.doc(`productions/alice-prod/${collection}/i-${i}`), { name: "Existing" });
    await batch.commit();
    await expect(service("alice", { action: "create", collection, productionId: "alice-prod", data: { name: "Overflow" } })).rejects.toMatchObject({ code: "resource-exhausted" });
    await service("alice", { action: "update", collection, productionId: "alice-prod", id: "i-0", data: { name: "Edit" } });
  });
  it("uses a sliding window and counts failed allocation requests", async () => {
    for (let i = 0; i < 60; i++) await expect(service("bob", { action: "update", collection: "productions", id: "alice-prod", data: { name: "Denied" } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("bob", { action: "set", collection: "users", data: { displayName: "Bob" } })).rejects.toMatchObject({ code: "resource-exhausted" });
    time += 60000;
    await service("bob", { action: "set", collection: "users", data: { displayName: "Bob" } });
  });
  it("preserves private ownership and forbids arbitrary collection and lifecycle writes", async () => {
    await expect(service("bob", { action: "create", collection: "investors", productionId: "alice-prod", data: { name: "X" } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("alice", { action: "set", collection: "mutationQuotas", id: "alice", data: { files: 0 } })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(service("alice", { action: "update", collection: "productions", id: "alice-prod", data: { userId: "bob" } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("alice", { action: "update", collection: "productions", id: "alice-prod", data: { deleting: false } })).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("creates the fixed default pool idempotently without overwriting a concurrent record", async () => {
    const input = { action: "ensure", collection: "producerPools", productionId: "alice-prod", id: "direct", data: { name: "Direct Investors" } };
    await Promise.all([service("alice", input), service("alice", input)]);
    expect((await db.collection("productions/alice-prod/producerPools").get()).size).toBe(1);
    await service("alice", { ...input, data: { name: "Overwrite" } });
    expect((await db.doc("productions/alice-prod/producerPools/direct").get()).data().name).toBe("Direct Investors");
  });
  it("rejects oversized payloads and occupied orphan paths without allocating", async () => {
    await expect(service("alice", { action: "set", collection: "users", data: { displayName: "x".repeat(65536) } })).rejects.toMatchObject({ code: "invalid-argument" });
    await db.doc("productions/old-id/investors/orphan").set({ name: "Previous owner" });
    await expect(service("bob", { action: "set", collection: "productions", id: "old-id", data: { name: "Reattach" } })).rejects.toMatchObject({ code: "not-found" });
  });
  it("publishes valid snapshots and retains reversible deactivation", async () => {
    const { id } = await service("alice", { action: "create", collection: "dealRooms", data: room });
    await service("alice", { action: "update", collection: "dealRooms", id, data: { isActive: false } });
    await service("alice", { action: "update", collection: "dealRooms", id, data: { isActive: true } });
    await expect(service("alice", { action: "update", collection: "dealRooms", id, data: { dealInputs: { investors: [{ name: "Private" }] } } })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(service("alice", { action: "update", collection: "dealRooms", id, data: { production: { name: "Show", operatingAgreementUrl: "https://example.test/private" } } })).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("fences concurrent child writes and permanently retires production IDs and room tokens", async () => {
    const { id } = await service("alice", { action: "create", collection: "dealRooms", data: room });
    await service("alice", { action: "create", collection: "investors", productionId: "alice-prod", data: { name: "Private" } });
    await service("alice", { action: "deleteProduction", productionId: "alice-prod" });
    expect((await db.doc("productions/alice-prod").get()).data()).toMatchObject({ userId: "alice", deleting: true, deleted: true });
    expect((await db.doc(`dealRooms/${id}`).get()).data()).toMatchObject({ retired: true, isActive: false });
    expect((await db.collection("productions/alice-prod/investors").get()).size).toBe(0);
    await expect(service("bob", { action: "set", collection: "productions", id: "alice-prod", data: { name: "Hijack" } })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("alice", { action: "set", collection: "dealRooms", id, data: room })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("alice", { action: "create", collection: "investors", productionId: "alice-prod", data: { name: "Late write" } })).rejects.toMatchObject({ code: "permission-denied" });
    await service("alice", { action: "deleteProduction", productionId: "alice-prod" });
  });
  it("limits concurrent file allocations and never frees quota on client deletion", async () => {
    await db.doc("mutationQuotas/alice").set({ files: 99, bytes: 0 });
    const input = { action: "reserveUpload", productionId: "alice-prod", logicalPath: "artwork", size: 1024, contentType: "image/png" };
    const results = await Promise.allSettled([service("alice", input), service("alice", input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const success = results.find(r => r.status === "fulfilled");
    if (success?.status === "fulfilled") await service("alice", { action: "deleteFile", path: success.value.path });
    expect((await db.doc("mutationQuotas/alice").get()).data().files).toBe(100);
    await expect(service("alice", input)).rejects.toMatchObject({ code: "resource-exhausted" });
  });
  it("allows the exact byte boundary and rejects overflow, malformed type, and cross-owner uploads", async () => {
    await db.doc("mutationQuotas/alice").set({ files: 0, bytes: 500 * 1024 * 1024 - 1024 });
    const input = { action: "reserveUpload", productionId: "alice-prod", logicalPath: "artwork", size: 1024, contentType: "image/png" };
    await service("alice", input);
    await expect(service("alice", input)).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(service("bob", input)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(service("alice", { ...input, contentType: "text/html" })).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
