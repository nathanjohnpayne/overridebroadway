/**
 * Storage security rules tests. Requires the Storage emulator — run via
 * `npm run test:rules` (wraps `firebase emulators:exec`).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-overridebroadway";
const MB = 1024 * 1024;

let testEnv: RulesTestEnvironment;
let sequence = 0;
const reservedPath = (uid: string, id: string) => `productions/${uid}/prod-1/uploads/${id}`;
async function reserve(uid: string, size: number, contentType: string, overrides: Record<string, unknown> = {}) {
  const id = `upload-${++sequence}`;
  const path = reservedPath(uid, id);
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`productions/prod-1`).set({ userId: uid });
    await ctx.firestore().doc(`uploadReservations/${id}`).set({ uid, productionId: "prod-1", path, size, contentType,
      expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 60000), ...overrides });
  });
  return path;
}

function storage(uid?: string) {
  return uid
    ? testEnv.authenticatedContext(uid).storage()
    : testEnv.unauthenticatedContext().storage();
}

function bytes(size: number): Uint8Array {
  return new Uint8Array(size);
}

/** Uploads through the compat SDK and returns a real Promise for assert*. */
function upload(uid: string | undefined, path: string, size: number, contentType: string) {
  return storage(uid)
    .ref(path)
    .put(bytes(size), { contentType })
    .then((snap) => snap);
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }" },
    storage: {
      rules: readFileSync(resolve(__dirname, "../../storage.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
});

describe("production file uploads", () => {
  it("allows the owner to upload a PDF", async () => {
    await assertSucceeds(
      upload("alice", await reserve("alice", 1024, "application/pdf"), 1024, "application/pdf")
    );
  });

  it("allows the owner to upload PNG/JPEG/WebP/GIF artwork", async () => {
    for (const contentType of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      await assertSucceeds(
        upload("alice", await reserve("alice", 1024, contentType), 1024, contentType)
      );
    }
  });

  it("denies disallowed content types", async () => {
    for (const contentType of ["text/html", "image/svg+xml", "application/javascript"]) {
      await assertFails(
        upload("alice", await reserve("alice", 1024, contentType), 1024, contentType)
      );
    }
  });

  it("denies files over 20MB", async () => {
    await assertFails(
      upload("alice", "productions/alice/prod-1/operating-agreement.pdf", 20 * MB + 1, "application/pdf")
    );
  });

  it("denies writes into another user's folder", async () => {
    await assertFails(
      upload("bob", "productions/alice/prod-1/operating-agreement.pdf", 1024, "application/pdf")
    );
    await assertFails(
      upload(undefined, "productions/alice/prod-1/operating-agreement.pdf", 1024, "application/pdf")
    );
  });

  it("lets the owner list while direct deletion requires the backend", async () => {
    const path = await reserve("alice", 1024, "application/pdf");
    await assertSucceeds(upload("alice", path, 1024, "application/pdf"));
    await assertFails(storage("bob").ref("productions/alice/prod-1").listAll());
    await assertSucceeds(storage("alice").ref("productions/alice/prod-1").listAll());
    await assertFails(storage("bob").ref(path).delete());
    await assertFails(storage("alice").ref(path).delete());
  });
  it("denies direct uploads without a reservation, mismatches, expiry and replay", async () => {
    await assertFails(upload("alice", reservedPath("alice", "missing"), 1024, "application/pdf"));
    const path = await reserve("alice", 1024, "application/pdf");
    await assertFails(upload("alice", path, 2048, "application/pdf"));
    await assertFails(upload("alice", path, 1024, "image/png"));
    await assertSucceeds(upload("alice", path, 1024, "application/pdf"));
    await assertFails(upload("alice", path, 1024, "application/pdf"));
    const expired = await reserve("alice", 1024, "application/pdf", { expiresAt: firebase.firestore.Timestamp.fromMillis(0) });
    await assertFails(upload("alice", expired, 1024, "application/pdf"));
  });
  it("denies reserved uploads after the production is fenced for deletion", async () => {
    const path = await reserve("alice", 1024, "application/pdf");
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc("productions/prod-1").update({ deleting: true });
    });
    await assertFails(upload("alice", path, 1024, "application/pdf"));
  });
});
