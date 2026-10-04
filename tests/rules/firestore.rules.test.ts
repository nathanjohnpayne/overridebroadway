/**
 * @spec deal-rooms
 *
 * Firestore security rules tests. Requires the Firestore emulator — run via
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
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const PROJECT_ID = "demo-overridebroadway";

let testEnv: RulesTestEnvironment;

const baseConfig = {
  showFinancialModel: true,
  showWaterfall: true,
  showCapitalizationProgress: false,
  showDocuments: false,
  showWeeklyBreakdown: false,
  producerNote: "",
};

function seededRoom(overrides: Record<string, unknown> = {}) {
  return {
    productionId: "prod-alice",
    ownedByUserId: "alice",
    production: { name: "Alice Show", status: "development" },
    dealInputs: { totalCapitalization: 1000000, capacity: 1000, investors: [] },
    config: baseConfig,
    isActive: true,
    createdAt: firebase.firestore.Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: firebase.firestore.Timestamp.fromMillis(1_700_000_000_000),
    ...overrides,
  };
}

/** The payload shape createDealRoom() writes (serverTimestamp sentinels). */
function newRoomPayload(overrides: Record<string, unknown> = {}) {
  return {
    productionId: "prod-alice",
    ownedByUserId: "alice",
    production: { name: "Alice Show", status: "development" },
    dealInputs: { totalCapitalization: 1000000, capacity: 1000, investors: [] },
    config: baseConfig,
    isActive: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  };
}

function db(uid?: string) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await admin.doc("productions/prod-alice").set({ userId: "alice", name: "Alice Show" });
    await admin.doc("productions/prod-bob").set({ userId: "bob", name: "Bob Show" });
    await admin.doc("dealRooms/active-room").set(seededRoom());
    await admin.doc("dealRooms/inactive-room").set(seededRoom({ isActive: false }));
    await admin.doc("dealRooms/bob-room").set(
      seededRoom({ productionId: "prod-bob", ownedByUserId: "bob" })
    );
  });
});

describe("dealRooms read access", () => {
  it("allows an unauthenticated get of an active room by token", async () => {
    await assertSucceeds(db().doc("dealRooms/active-room").get());
  });

  it("denies an unauthenticated get of an inactive room", async () => {
    await assertFails(db().doc("dealRooms/inactive-room").get());
  });

  it("allows a get of a token that does not exist (reports not found)", async () => {
    await assertSucceeds(db().doc("dealRooms/no-such-token").get());
  });

  it("fails closed for non-owners on an active legacy room with unapproved document URLs", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/legacy-active").set(
        seededRoom({
          production: { name: "Alice Show", status: "open", operatingAgreementUrl: "https://example.test/oa.pdf" },
        })
      );
      await ctx.firestore().doc("dealRooms/docs-active").set(
        seededRoom({
          config: { ...baseConfig, showDocuments: true },
          production: { name: "Alice Show", status: "open", operatingAgreementUrl: "https://example.test/oa.pdf" },
        })
      );
    });
    await assertFails(db().doc("dealRooms/legacy-active").get());
    await assertFails(db("bob").doc("dealRooms/legacy-active").get());
    await assertSucceeds(db("alice").doc("dealRooms/legacy-active").get());
    await assertSucceeds(db().doc("dealRooms/docs-active").get());
  });

  it("fails closed for non-owners on an active legacy room that still lists investors", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/legacy-investors").set(
        seededRoom({
          dealInputs: {
            totalCapitalization: 1000000,
            investors: [{ id: "i1", name: "Jane", amount: 50000, units: 2 }],
          },
        })
      );
    });
    await assertFails(db().doc("dealRooms/legacy-investors").get());
    await assertFails(db("bob").doc("dealRooms/legacy-investors").get());
    await assertSucceeds(db("alice").doc("dealRooms/legacy-investors").get());
  });

  it("allows the owner to get their own inactive room", async () => {
    await assertSucceeds(db("alice").doc("dealRooms/inactive-room").get());
  });

  it("denies another signed-in user a get of an inactive room", async () => {
    await assertFails(db("bob").doc("dealRooms/inactive-room").get());
  });

  it("denies unauthenticated queries over deal rooms", async () => {
    await assertFails(db().collection("dealRooms").where("isActive", "==", true).get());
    await assertFails(db().collection("dealRooms").get());
  });

  it("denies a signed-in user querying another owner's rooms", async () => {
    await assertFails(
      db("bob").collection("dealRooms").where("ownedByUserId", "==", "alice").get()
    );
    await assertFails(db("bob").collection("dealRooms").where("isActive", "==", true).get());
  });

  it("allows the owner's getProductionDealRooms query", async () => {
    await assertSucceeds(
      db("alice")
        .collection("dealRooms")
        .where("productionId", "==", "prod-alice")
        .where("ownedByUserId", "==", "alice")
        .orderBy("createdAt", "desc")
        .get()
    );
  });
});

describe("dealRooms create", () => {
  it("denies direct room creation even by the production owner", async () => {
    await assertFails(db("alice").collection("dealRooms").add(newRoomPayload()));
  });

  it("denies creating a room for a production the caller does not own", async () => {
    await assertFails(
      db("alice").collection("dealRooms").add(newRoomPayload({ productionId: "prod-bob" }))
    );
  });

  it("denies creating a room for a production that does not exist", async () => {
    await assertFails(
      db("alice").collection("dealRooms").add(newRoomPayload({ productionId: "prod-missing" }))
    );
  });

  it("denies creating a room owned by someone else", async () => {
    await assertFails(
      db("alice").collection("dealRooms").add(newRoomPayload({ ownedByUserId: "bob" }))
    );
  });

  it("denies unauthenticated creates", async () => {
    await assertFails(db().collection("dealRooms").add(newRoomPayload()));
  });

  it("denies unexpected top-level fields", async () => {
    await assertFails(
      db("alice").collection("dealRooms").add(newRoomPayload({ extra: "nope" }))
    );
  });

  it("denies a producer note over 500 characters", async () => {
    await assertFails(
      db("alice")
        .collection("dealRooms")
        .add(newRoomPayload({ config: { ...baseConfig, producerNote: "x".repeat(501) } }))
    );
    await assertFails(
      db("alice")
        .collection("dealRooms")
        .add(newRoomPayload({ config: { ...baseConfig, producerNote: "x".repeat(500) } }))
    );
  });

  it("denies publishing individual investors", async () => {
    await assertFails(
      db("alice")
        .collection("dealRooms")
        .add(
          newRoomPayload({
            dealInputs: {
              totalCapitalization: 1000000,
              investors: [{ id: "i1", name: "Jane", amount: 50000, units: 2 }],
            },
          })
        )
    );
  });

  it("denies document URLs when showDocuments is off", async () => {
    const withDocs = {
      name: "Alice Show",
      status: "open",
      operatingAgreementUrl: "https://example.test/oa.pdf",
      operatingAgreementName: "oa.pdf",
    };
    await assertFails(
      db("alice").collection("dealRooms").add(newRoomPayload({ production: withDocs }))
    );
    await assertFails(
      db("alice")
        .collection("dealRooms")
        .add(newRoomPayload({ production: withDocs, config: { ...baseConfig, showDocuments: true } }))
    );
  });

  it("denies unexpected production snapshot fields", async () => {
    await assertFails(
      db("alice")
        .collection("dealRooms")
        .add(newRoomPayload({ production: { name: "Alice Show", userId: "alice" } }))
    );
  });
});

describe("dealRooms update/delete", () => {
  it("denies direct room activation changes", async () => {
    const ref = db("alice").doc("dealRooms/active-room");
    await assertFails(
      ref.update({ isActive: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    );
    await assertFails(
      db("alice")
        .doc("dealRooms/inactive-room")
        .update({ isActive: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    );
  });

  it("denies direct snapshot updates", async () => {
    await assertFails(
      db("alice").doc("dealRooms/active-room").update({
        config: { ...baseConfig, showDocuments: true, producerNote: "Hello" },
        production: {
          name: "Alice Show",
          status: "open",
          operatingAgreementUrl: "https://example.test/oa.pdf",
          operatingAgreementName: "oa.pdf",
        },
        dealInputs: { totalCapitalization: 2000000, investors: [] },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it("denies turning showDocuments off while document URLs remain", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/docs-room").set(
        seededRoom({
          config: { ...baseConfig, showDocuments: true },
          production: {
            name: "Alice Show",
            status: "open",
            operatingAgreementUrl: "https://example.test/oa.pdf",
          },
        })
      );
    });
    const ref = db("alice").doc("dealRooms/docs-room");
    await assertFails(
      ref.update({
        config: baseConfig,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
    await assertFails(
      ref.update({
        config: baseConfig,
        production: { name: "Alice Show", status: "open" },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it("denies direct deactivation of legacy rooms", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/legacy-room").set(
        seededRoom({
          production: { name: "Alice Show", status: "open", operatingAgreementUrl: "https://example.test/oa.pdf" },
        })
      );
    });
    await assertFails(
      db("alice")
        .doc("dealRooms/legacy-room")
        .update({ isActive: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    );
  });

  it("denies reactivating a legacy room without sanitizing its snapshot", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/legacy-inactive").set(
        seededRoom({
          isActive: false,
          production: { name: "Alice Show", status: "open", operatingAgreementUrl: "https://example.test/oa.pdf" },
        })
      );
    });
    const ref = db("alice").doc("dealRooms/legacy-inactive");
    await assertFails(
      ref.update({ isActive: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    );
    await assertFails(
      ref.update({
        isActive: true,
        production: { name: "Alice Show", status: "open" },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it("requires a sanitized deal-input snapshot to reactivate a legacy room with investors", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("dealRooms/legacy-inv-inactive").set(
        seededRoom({
          isActive: false,
          dealInputs: {
            totalCapitalization: 1000000,
            investors: [{ id: "i1", name: "Jane", amount: 50000, units: 2 }],
          },
        })
      );
    });
    const ref = db("alice").doc("dealRooms/legacy-inv-inactive");
    await assertFails(
      ref.update({ isActive: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    );
    // The shape DealRoomSetup's Reactivate writes: config + sanitized
    // production + sanitized deal inputs.
    await assertFails(
      ref.update({
        isActive: true,
        config: baseConfig,
        production: { name: "Alice Show", status: "development" },
        dealInputs: { totalCapitalization: 1000000, investors: [] },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  });

  it("denies a client-chosen updatedAt", async () => {
    await assertFails(
      db("alice")
        .doc("dealRooms/active-room")
        .update({ isActive: false, updatedAt: firebase.firestore.Timestamp.fromMillis(0) })
    );
  });

  it("denies changing ownedByUserId", async () => {
    await assertFails(db("alice").doc("dealRooms/active-room").update({ ownedByUserId: "bob" }));
  });

  it("denies changing productionId", async () => {
    await assertFails(db("alice").doc("dealRooms/active-room").update({ productionId: "prod-bob" }));
  });

  it("denies an over-long producer note on update", async () => {
    await assertFails(
      db("alice")
        .doc("dealRooms/active-room")
        .update({ config: { ...baseConfig, producerNote: "x".repeat(501) } })
    );
  });

  it("denies non-owners updating or deleting", async () => {
    await assertFails(db("bob").doc("dealRooms/active-room").update({ isActive: false }));
    await assertFails(db("bob").doc("dealRooms/active-room").delete());
    await assertFails(db().doc("dealRooms/active-room").update({ isActive: false }));
  });

  it("denies direct owner deletion", async () => {
    await assertFails(db("alice").doc("dealRooms/active-room").delete());
  });
});

describe("productions ownership", () => {
  it("denies direct production updates", async () => {
    await assertFails(db("alice").doc("productions/prod-alice").update({ name: "Renamed" }));
  });

  it("denies the owner reassigning userId", async () => {
    await assertFails(db("alice").doc("productions/prod-alice").update({ userId: "bob" }));
  });

  it("denies non-owners reading or updating", async () => {
    await assertFails(db("bob").doc("productions/prod-alice").get());
    await assertFails(db("bob").doc("productions/prod-alice").update({ name: "x" }));
  });

  it("denies direct deletion of subcollections and productions", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("productions/prod-alice/investors/i1").set({ name: "Jane" });
    });
    await assertFails(db("alice").doc("productions/prod-alice/investors/i1").delete());
    await assertFails(db("alice").doc("productions/prod-alice").delete());
  });
});
