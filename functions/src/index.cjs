const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { createService } = require('./service.cjs');
initializeApp();
const service = createService({ db: getFirestore(), bucket: getStorage().bucket(), Timestamp, FieldValue, HttpsError });
exports.mutate = onCall({ region: 'us-central1', maxInstances: 10, timeoutSeconds: 60 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  return service(request.auth.uid, request.data);
});
