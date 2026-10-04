const { randomUUID } = require('node:crypto');
const LIMITS = Object.freeze({ productions: 20, investors: 200, scenarios: 20, producerPools: 20, dealRooms: 20, files: 100, bytes: 500 * 1024 * 1024, mutations: 60 });
const DOCUMENT_FIELDS = ['investorInstructionLetterUrl', 'investorInstructionLetterName', 'memberSignaturePageUrl', 'memberSignaturePageName', 'subscriptionAgreementUrl', 'subscriptionAgreementName', 'operatingAgreementUrl', 'operatingAgreementName'];
const PRODUCTION_FIELDS = ['name', 'subtitle', 'venue', 'status', 'showUrl', 'artworkUrl', ...DOCUMENT_FIELDS, 'hasPersonalInvestment', 'dealRoomEnabled', 'dealRoomToken'];
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
function createService({ db, bucket, Timestamp, FieldValue, HttpsError, now = Date.now, uuid = randomUUID }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid-argument', 'Expected an object.');
    return value;
  }
  function identifier(value) {
    if (typeof value !== 'string' || !idPattern.test(value)) fail('invalid-argument', 'Invalid identifier.');
    return value;
  }
  function allowed(data, keys) {
    if (Object.keys(data).some(k => !keys.includes(k))) fail('invalid-argument', 'Unexpected field.');
  }
  function room(data) {
    allowed(data, ['productionId', 'ownedByUserId', 'production', 'dealInputs', 'config', 'isActive', 'expiresAt', 'createdAt', 'updatedAt']);
    const p = object(data.production), d = object(data.dealInputs), c = object(data.config);
    allowed(p, ['name', 'subtitle', 'venue', 'status', 'artworkUrl', 'showUrl', ...DOCUMENT_FIELDS]);
    allowed(c, ['showFinancialModel', 'showWaterfall', 'showCapitalizationProgress', 'showDocuments', 'showWeeklyBreakdown', 'producerNote']);
    if (typeof p.name !== 'string' || typeof data.isActive !== 'boolean' || (d.investors !== undefined && (!Array.isArray(d.investors) || d.investors.length))) fail('invalid-argument', 'Invalid room snapshot.');
    for (const k of Object.keys(c).filter(k => k !== 'producerNote')) if (typeof c[k] !== 'boolean') fail('invalid-argument', 'Invalid room configuration.');
    if (c.producerNote !== undefined && (typeof c.producerNote !== 'string' || c.producerNote.length > 500)) fail('invalid-argument', 'Producer note is too long.');
    if (!c.showDocuments && DOCUMENT_FIELDS.some(k => k in p)) fail('invalid-argument', 'Documents require opt-in.');
  }
  async function own(tx, uid, productionId, allowDeleting = false) {
    const ref = db.doc(`productions/${identifier(productionId)}`), snap = await tx.get(ref), data = snap.data();
    if (!snap.exists || data.userId !== uid || data.deleted || (!allowDeleting && data.deleting)) fail('permission-denied', 'Production is unavailable.');
    return { ref, data };
  }
  async function rate(uid) {
    await db.runTransaction(async tx => {
      const ref = db.doc(`mutationQuotas/${uid}`), snap = await tx.get(ref), time = now();
      const recent = (snap.data()?.recent || []).filter(t => t > time - 60000);
      if (recent.length >= LIMITS.mutations) fail('resource-exhausted', 'Please wait before making more changes.');
      tx.set(ref, { recent: [...recent, time] }, { merge: true });
    });
  }
  async function retireFile(uid, path) {
    const match = path.match(/^productions\/[^/]+\/[^/]+\/uploads\/([A-Za-z0-9_-]+)$/);
    if (match) {
      const ref = db.doc(`uploadReservations/${match[1]}`);
      await db.runTransaction(async tx => {
        const reservation = (await tx.get(ref)).data();
        if (reservation?.uid === uid && reservation.path === path) tx.delete(ref);
      });
    }
    await bucket.file(path).delete({ ignoreNotFound: true });
  }
  function ownedObjectPath(uid, productionId, url) {
    if (typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      const prefix = `/v0/b/${bucket.name}/o/`;
      if (parsed.hostname !== 'firebasestorage.googleapis.com' || !parsed.pathname.startsWith(prefix)) return null;
      const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
      return path.startsWith(`productions/${uid}/${productionId}/`) && !path.includes('..') ? path : null;
    } catch { return null; }
  }
  return async (uid, input) => {
    object(input); identifier(uid);
    if (Buffer.byteLength(JSON.stringify(input)) > 64 * 1024) fail('invalid-argument', 'Request is too large.');
    await rate(uid);
    if (input.action === 'reserveUpload') {
      identifier(input.productionId);
      if (typeof input.logicalPath !== 'string' || !/^(artwork|agreement\.pdf|(?:instruction-letter|member-signature-page|subscription-agreement|operating-agreement)\.pdf|investors\/[A-Za-z0-9_-]+\/(?:distributed|signed|executed)\/(?:instruction-letter|signature-page|subscription-agreement)\.pdf)$/.test(input.logicalPath)) fail('invalid-argument', 'Invalid upload path.');
      const image = input.logicalPath === 'artwork';
      if (!(image ? ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(input.contentType) : input.contentType === 'application/pdf')) fail('invalid-argument', 'Invalid file type.');
      if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > (image ? 5 : 20) * 1024 * 1024) fail('invalid-argument', 'Invalid file size.');
      const uploadId = uuid(), path = `productions/${uid}/${input.productionId}/uploads/${uploadId}`;
      await db.runTransaction(async tx => {
        await own(tx, uid, input.productionId);
        if (input.logicalPath.startsWith('investors/')) {
          const investor = await tx.get(db.doc(`productions/${input.productionId}/investors/${input.logicalPath.split('/')[1]}`));
          if (!investor.exists) fail('not-found', 'Investor is unavailable.');
        }
        const quotaRef = db.doc(`mutationQuotas/${uid}`), quota = (await tx.get(quotaRef)).data();
        // Existing storage must be reconciled before enabling this backend.
        if ((quota.files || 0) >= LIMITS.files || (quota.bytes || 0) + input.size > LIMITS.bytes) fail('resource-exhausted', 'Upload quota reached.');
        tx.set(quotaRef, { files: (quota.files || 0) + 1, bytes: (quota.bytes || 0) + input.size }, { merge: true });
        tx.create(db.doc(`uploadReservations/${uploadId}`), { uid, productionId: input.productionId, path, size: input.size, contentType: input.contentType, expiresAt: Timestamp.fromMillis(now() + 15 * 60000) });
      });
      return { path };
    }
    if (input.action === 'deleteFile') {
      if (typeof input.path !== 'string' || !input.path.startsWith(`productions/${uid}/`) || input.path.includes('..')) fail('permission-denied', 'Invalid file path.');
      await retireFile(uid, input.path);
      return {};
    }
    if (input.action === 'assignDefaultPool') {
      const productionId = identifier(input.productionId), poolId = identifier(input.id);
      await db.runTransaction(async tx => {
        await own(tx, uid, productionId);
        const pool = await tx.get(db.doc(`productions/${productionId}/producerPools/${poolId}`));
        if (!pool.exists) fail('not-found', 'Pool is unavailable.');
        const investors = await tx.get(db.collection(`productions/${productionId}/investors`).limit(LIMITS.investors + 1));
        if (investors.size > LIMITS.investors) fail('resource-exhausted', 'Legacy investors exceed the migration limit.');
        for (const investor of investors.docs) if (!investor.data().producerPoolId) tx.update(investor.ref, { producerPoolId: poolId, updatedAt: FieldValue.serverTimestamp() });
      });
      return {};
    }
    if (input.action === 'deleteProduction') {
      const productionId = identifier(input.productionId);
      const productionRef = db.doc(`productions/${productionId}`);
      await db.runTransaction(async tx => {
        const snap = await tx.get(productionRef);
        if (!snap.exists || snap.data().userId !== uid) fail('permission-denied', 'Production is unavailable.');
        if (!snap.data().deleted) tx.update(productionRef, { deleting: true, updatedAt: FieldValue.serverTimestamp() });
      });
      const rooms = await db.collection('dealRooms').where('productionId', '==', productionId).where('ownedByUserId', '==', uid).get();
      for (const r of rooms.docs) {
        const createdAt = r.data().createdAt;
        await r.ref.set({ productionId, ownedByUserId: uid, retired: true, isActive: false, ...(createdAt ? { createdAt } : {}), updatedAt: FieldValue.serverTimestamp() });
      }
      for (const collection of ['dealInputs', 'scenarios', 'investors', 'producerPools']) {
        const children = await productionRef.collection(collection).get();
        for (let i = 0; i < children.docs.length; i += 400) {
          const batch = db.batch();
          for (const child of children.docs.slice(i, i + 400)) batch.delete(child.ref);
          await batch.commit();
        }
      }
      // Invalidate authorizations before deleting objects so replay cannot recreate them.
      const reservations = await db.collection('uploadReservations').where('uid', '==', uid).where('productionId', '==', productionId).get();
      for (let i = 0; i < reservations.docs.length; i += 400) {
        const batch = db.batch();
        for (const reservation of reservations.docs.slice(i, i + 400)) batch.delete(reservation.ref);
        await batch.commit();
      }
      await bucket.deleteFiles({ prefix: `productions/${uid}/${productionId}/`, force: true });
      await productionRef.set({ userId: uid, deleted: true, deleting: true, updatedAt: FieldValue.serverTimestamp() });
      return {};
    }
    if (!['create', 'set', 'update', 'delete', 'ensure'].includes(input.action)) fail('invalid-argument', 'Unknown action.');
    const collection = input.collection;
    if (!['users', 'productions', 'dealInputs', 'scenarios', 'investors', 'producerPools', 'dealRooms'].includes(collection)) fail('invalid-argument', 'Unknown collection.');
    const data = input.action === 'delete' ? {} : object(input.data);
    if (collection === 'dealRooms' && data.expiresAt !== undefined) {
      if (typeof data.expiresAt !== 'string') fail('invalid-argument', 'Invalid expiry.');
      const millis = Date.parse(data.expiresAt);
      if (!Number.isFinite(millis)) fail('invalid-argument', 'Invalid expiry.');
      data.expiresAt = Timestamp.fromMillis(millis);
    }
    if (['__proto__', 'constructor', 'prototype', 'deleted', 'deleting', 'retired', 'createdAt', 'updatedAt', 'cleanupPaths'].some(k => Object.hasOwn(data, k))) fail('invalid-argument', 'Reserved field.');
    const id = collection === 'users' ? uid : input.action === 'create' ? uuid() : identifier(input.id);
    if (collection === 'dealInputs' && id !== 'primary') fail('invalid-argument', 'Invalid deal input id.');
    const child = ['dealInputs', 'scenarios', 'investors', 'producerPools'].includes(collection);
    const parent = child ? `productions/${identifier(input.productionId)}/` : '';
    const ref = db.doc(`${parent}${collection}/${id}`);
    let cleanupPaths = [];
    await db.runTransaction(async tx => {
      // Serialize all allocations for one user, including first legacy allocations.
      const quotaRef = db.doc(`mutationQuotas/${uid}`), quotaSnap = await tx.get(quotaRef);
      const existing = await tx.get(ref), old = existing.data();
      cleanupPaths = [...(old?.cleanupPaths || [])];
      if (collection === 'productions' || collection === 'investors') {
        const productionId = collection === 'productions' ? id : input.productionId;
        for (const key of Object.keys(data).filter(k => k.endsWith('Url'))) {
          if (old?.[key] !== data[key]) {
            const path = ownedObjectPath(uid, productionId, old?.[key]);
            if (path && !cleanupPaths.includes(path)) cleanupPaths.push(path);
          }
        }
      }
      if (child) await own(tx, uid, input.productionId);
      if (collection === 'productions') {
        if (existing.exists && (old.userId !== uid || old.deleted || old.deleting)) fail('permission-denied', 'Production is unavailable.');
        if (input.action !== 'create' && !existing.exists) fail('not-found', 'Production is unavailable.');
        if (input.action === 'delete') fail('invalid-argument', 'Use deleteProduction.');
        allowed(data, [...PRODUCTION_FIELDS, 'userId']);
        if (data.userId !== undefined && data.userId !== uid) fail('permission-denied', 'Owner cannot change.');
      }
      if (collection === 'users') allowed(data, ['email', 'displayName', 'photoURL']);
      if (collection === 'dealInputs' && data.investors !== undefined && (!Array.isArray(data.investors) || data.investors.length)) fail('invalid-argument', 'Deal input investors must remain empty.');
      if (collection === 'dealRooms') {
        if (existing.exists && (old.ownedByUserId !== uid || old.retired)) fail('permission-denied', 'Room is unavailable.');
        if (!existing.exists && input.action !== 'create') fail('not-found', 'Room is unavailable.');
        if (input.action === 'delete') fail('invalid-argument', 'Deactivate the room instead.');
        const next = { ...old, ...data };
        if (next.ownedByUserId !== uid || (old && next.productionId !== old.productionId)) fail('permission-denied', 'Room owner and production cannot change.');
        await own(tx, uid, next.productionId);
        // Deactivation must remain possible for legacy snapshots that no longer validate.
        if (!(Object.keys(data).length === 1 && data.isActive === false)) room(next);

      }
      if (input.action === 'update' && !existing.exists) fail('not-found', 'Record is unavailable.');
      if (!existing.exists && LIMITS[collection]) {
        let query = db.collection(`${parent}${collection}`);
        if (collection === 'productions') query = query.where('userId', '==', uid);
        if (collection === 'dealRooms') query = query.where('productionId', '==', data.productionId).where('ownedByUserId', '==', uid);
        // The finite query bound prevents scanning attacker-controlled unbounded data.
        const records = await tx.get(query.limit(LIMITS[collection] + 1));
        if (records.size >= LIMITS[collection]) fail('resource-exhausted', `${collection} quota reached.`);
      }
      if (input.action === 'ensure' && existing.exists) return;
      tx.set(quotaRef, { allocations: (quotaSnap.data()?.allocations || 0) + 1 }, { merge: true });
      if (input.action === 'delete') tx.delete(ref);
      else {
        const payload = { ...data, updatedAt: FieldValue.serverTimestamp() };
        if (cleanupPaths.length) payload.cleanupPaths = cleanupPaths;
        if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
        if (collection === 'productions') payload.userId = uid;
        tx.set(ref, payload, { merge: true });
      }
    });
    for (const path of cleanupPaths) await retireFile(uid, path);
    if (cleanupPaths.length && input.action !== 'delete') {
      await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (current.exists) tx.update(ref, { cleanupPaths: (current.data().cleanupPaths || []).filter(p => !cleanupPaths.includes(p)) });
      });
    }
    return { id };
  };
}
module.exports = { createService, LIMITS };
