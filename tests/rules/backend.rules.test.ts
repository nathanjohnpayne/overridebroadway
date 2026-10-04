/** @spec resource-quotas */
import { createHash } from "node:crypto";
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
    bucket: { name: "demo-bucket", deleteFiles: async () => {}, file: () => ({ delete: async () => {} }) } });
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
    await expect(service("alice", { action: "update", collection: "productions", id: "alice-prod", data: { artworkUrl: "https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/productions%2Falice%2Falice-prod%2Fuploads%2Ffake" } })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection("uploadObjects").get()).size).toBe(0);
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
    await expect(service("alice", { action: "set", collection: "dealRooms", id: "previously-deleted-token", data: room })).rejects.toMatchObject({ code: "not-found" });
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
    expect((await db.collection("uploadReservations").get()).size).toBe(0);
    expect((await db.doc("mutationQuotas/alice").get()).data().files).toBe(100);
    await expect(service("alice", input)).rejects.toMatchObject({ code: "resource-exhausted" });
  });
  it("migrates 200 legacy investors in one mutation without changing assigned investors", async () => {
    await db.doc("productions/alice-prod/producerPools/direct").set({ name: "Direct" });
    const batch = db.batch();
    for (let i = 0; i < 200; i++) batch.set(db.doc(`productions/alice-prod/investors/i-${i}`), { name: "Legacy", ...(i === 0 ? { producerPoolId: "other" } : {}) });
    await batch.commit();
    await service("alice", { action: "assignDefaultPool", productionId: "alice-prod", id: "direct" });
    const investors = await db.collection("productions/alice-prod/investors").get();
    expect(investors.docs.filter((d: { data(): { producerPoolId?: string } }) => d.data().producerPoolId === "direct")).toHaveLength(199);
    expect((await db.doc("mutationQuotas/alice").get()).data().recent).toHaveLength(1);
    await expect(service("bob", { action: "assignDefaultPool", productionId: "alice-prod", id: "direct" })).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("retires replaced objects and retries cleanup after a failed Storage deletion", async () => {
    const oldPath = "productions/alice/alice-prod/uploads/old-file";
    const oldUrl = `https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/${encodeURIComponent(oldPath)}?token=old`;
    await db.doc(`uploadObjects/${createHash("sha256").update(oldPath).digest("hex")}`).set({ uid: "alice", path: oldPath, retired: false });
    await db.doc("productions/alice-prod").update({ artworkUrl: oldUrl });
    await db.doc("uploadReservations/old-file").set({ uid: "alice", path: oldPath });
    let failDelete = true;
    const deleted: string[] = [];
    const replace = createService({ db, Timestamp, FieldValue, HttpsError, now: () => time, bucket: { name: "demo-bucket", file: (path: string) => ({ delete: async () => { if (failDelete) throw new Error("Storage unavailable"); deleted.push(path); } }) } });
    const input = { action: "update", collection: "productions", id: "alice-prod", data: { artworkUrl: "https://example.test/new" } };
    await expect(replace("alice", input)).rejects.toThrow("Storage unavailable");
    expect((await db.doc("uploadReservations/old-file").get()).exists).toBe(false);
    expect((await db.doc("productions/alice-prod").get()).data().cleanupPaths).toEqual([oldPath]);
    await expect(replace("alice", { ...input, data: { artworkUrl: oldUrl } })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.doc("productions/alice-prod").get()).data().artworkUrl).toBe("https://example.test/new");
    failDelete = false;
    await replace("alice", input);
    expect(deleted).toEqual([oldPath]);
    expect((await db.doc("productions/alice-prod").get()).data().cleanupPaths).toEqual([]);
  });
  it("preserves snapshotted files until a room refresh releases them", async () => {
    const path = "productions/alice/alice-prod/uploads/snapshot-file";
    const url = `https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/${encodeURIComponent(path)}?token=old`;
    const deleted: string[] = [];
    const mutate = createService({ db, Timestamp, FieldValue, HttpsError, now: () => time, bucket: { name: "demo-bucket", file: (p: string) => ({ delete: async () => { deleted.push(p); } }) } });
    await db.doc(`uploadObjects/${createHash("sha256").update(path).digest("hex")}`).set({ uid: "alice", path, retired: false });
    await db.doc("productions/alice-prod").update({ artworkUrl: url });
    const { id } = await mutate("alice", { action: "create", collection: "dealRooms", data: { ...room, production: { name: "Alice", artworkUrl: url } } });
    await mutate("alice", { action: "update", collection: "productions", id: "alice-prod", data: { artworkUrl: "https://example.test/new" } });
    expect(deleted).toEqual([]);
    await mutate("alice", { action: "update", collection: "productions", id: "alice-prod", data: { artworkUrl: url } });
    expect((await db.doc("productions/alice-prod").get()).data().cleanupPaths).toEqual([]);
    expect(deleted).toEqual([]);
    await mutate("alice", { action: "update", collection: "productions", id: "alice-prod", data: { artworkUrl: "https://example.test/new" } });
    await mutate("alice", { action: "update", collection: "dealRooms", id, data: { production: { name: "Alice", artworkUrl: "https://example.test/new" } } });
    expect(deleted).toEqual([path]);
  });
  it("retains a failed investor deletion for retry and removes its documents", async () => {
    const path = "productions/alice/alice-prod/uploads/investor-file";
    const url = `https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/${encodeURIComponent(path)}?token=old`;
    await db.doc(`uploadObjects/${createHash("sha256").update(path).digest("hex")}`).set({ uid: "alice", path, retired: false });
    await db.doc("productions/alice-prod/investors/legacy").set({ name: "Legacy", signedSignaturePageUrl: url, isPersonalInvestment: true });
    let failDelete = true;
    const deleted: string[] = [];
    const mutate = createService({ db, Timestamp, FieldValue, HttpsError, now: () => time, bucket: { name: "demo-bucket", file: (p: string) => ({ delete: async () => { if (failDelete) throw new Error("Storage unavailable"); deleted.push(p); } }) } });
    const input = { action: "delete", collection: "investors", productionId: "alice-prod", id: "legacy" };
    await expect(mutate("alice", input)).rejects.toThrow("Storage unavailable");
    expect((await db.doc("productions/alice-prod/investors/legacy").get()).data()).toMatchObject({ deleting: true, cleanupPaths: [path] });
    failDelete = false;
    await mutate("alice", input);
    expect(deleted).toEqual([path]);
    expect((await db.doc("productions/alice-prod/investors/legacy").get()).exists).toBe(false);
    expect((await db.doc("productions/alice-prod").get()).data().hasPersonalInvestment).toBe(false);
  });
  it("commits investor and room metadata even at the last mutation slot", async () => {
    await db.doc("mutationQuotas/alice").set({ recent: Array(59).fill(time) });
    await service("alice", { action: "create", collection: "investors", productionId: "alice-prod", data: { isPersonalInvestment: true } });
    expect((await db.doc("productions/alice-prod").get()).data().hasPersonalInvestment).toBe(true);
    time += 60000;
    await db.doc("mutationQuotas/alice").set({ recent: Array(59).fill(time) });
    const { id } = await service("alice", { action: "create", collection: "dealRooms", data: room });
    expect((await db.doc("productions/alice-prod").get()).data()).toMatchObject({ dealRoomToken: id, dealRoomEnabled: true });
  });
  it("keeps a failed production deletion fenced for retry and cleans 100 files in one operation", async () => {
    await db.doc("dealRooms/legacy-no-timestamp").set({ productionId: "alice-prod", ownedByUserId: "alice", isActive: true });
    let failCleanup = true;
    const prefixes: string[] = [];
    const remove = createService({ db, Timestamp, FieldValue, HttpsError, now: () => time, bucket: { deleteFiles: async ({ prefix }: { prefix: string }) => { if (failCleanup) throw new Error("Storage unavailable"); prefixes.push(prefix); } } });
    const batch = db.batch();
    for (let i = 0; i < 100; i++) batch.set(db.doc(`uploadReservations/file-${i}`), { uid: "alice", productionId: "alice-prod" });
    await batch.commit();
    await expect(remove("alice", { action: "deleteProduction", productionId: "alice-prod" })).rejects.toThrow("Storage unavailable");
    expect((await db.doc("productions/alice-prod").get()).data()).toMatchObject({ name: "Alice", deleting: true });
    expect((await db.collection("uploadReservations").get()).size).toBe(0);
    failCleanup = false;
    await remove("alice", { action: "deleteProduction", productionId: "alice-prod" });
    expect(prefixes).toEqual(["productions/alice/alice-prod/"]);
    expect((await db.doc("mutationQuotas/alice").get()).data().recent).toHaveLength(2);
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
