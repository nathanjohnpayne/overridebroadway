/**
 * Storage security rules tests. Requires the Storage emulator — run via
 * `npm run test:rules` (wraps `firebase emulators:exec`).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
});

describe("production file uploads", () => {
  it("allows the owner to upload a PDF", async () => {
    await assertSucceeds(
      upload("alice", "productions/alice/prod-1/operating-agreement.pdf", 1024, "application/pdf")
    );
  });

  it("allows the owner to upload PNG/JPEG/WebP/GIF artwork", async () => {
    for (const contentType of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      await assertSucceeds(
        upload("alice", "productions/alice/prod-1/artwork", 1024, contentType)
      );
    }
  });

  it("denies disallowed content types", async () => {
    for (const contentType of ["text/html", "image/svg+xml", "application/javascript"]) {
      await assertFails(
        upload("alice", "productions/alice/prod-1/artwork", 1024, contentType)
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

  it("lets only the owner delete and list files", async () => {
    await assertSucceeds(
      upload("alice", "productions/alice/prod-1/investors/inv-1/signed/signature-page.pdf", 1024, "application/pdf")
    );
    await assertFails(storage("bob").ref("productions/alice/prod-1").listAll());
    await assertSucceeds(storage("alice").ref("productions/alice/prod-1").listAll());
    await assertFails(
      storage("bob")
        .ref("productions/alice/prod-1/investors/inv-1/signed/signature-page.pdf")
        .delete()
    );
    await assertSucceeds(
      storage("alice")
        .ref("productions/alice/prod-1/investors/inv-1/signed/signature-page.pdf")
        .delete()
    );
  });
});
