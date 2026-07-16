// JetSetter Pro Cloud Functions — entry point. Each function lives in its own
// module; every secret lives ONLY here, server-side:
//
//   aiIris          POST   streaming Anthropic proxy      ANTHROPIC_API_KEY
//   flightData      GET    flight status/position lookup  AERODATABOX_API_KEY (+ OPENSKY_*)
//   translate       POST   Google Cloud Translation v2    (ADC — no key)
//   duffelApi       POST   flight booking (test mode)     DUFFEL_API_KEY
//   disruptionWatch cron   status diffs → events + push   AERODATABOX_API_KEY (+ EXPO_ACCESS_TOKEN)
//
// Deploy: firebase deploy --only functions   (Blaze plan required: outbound
// HTTP + Cloud Scheduler). Set secrets with `firebase functions:secrets:set`.
const admin = require('firebase-admin');
const { setGlobalOptions } = require('firebase-functions/v2');

admin.initializeApp();

// Global runtime defaults for every function below. `maxInstances` is the key
// cost guard for the beta: it bounds how many instances can spin up under a
// traffic spike or abuse, capping worst-case Cloud Functions + upstream-API
// spend. Region is pinned so functions and Firestore stay co-located.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

exports.aiIris = require('./aiIris').aiIris;
exports.flightData = require('./flightData').flightData;
exports.translate = require('./translate').translate;
exports.duffelApi = require('./duffel').duffelApi;
exports.disruptionWatch = require('./disruptionWatch').disruptionWatch;
