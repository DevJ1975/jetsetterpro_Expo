// Shared Firebase ID-token verification for every HTTP function.
const admin = require('firebase-admin');

/**
 * Verifies the `Authorization: Bearer <Firebase ID token>` header.
 * @returns decoded token, or null (after writing the 401) if unauthorized.
 */
async function verifyBearer(req, res) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(m[1]);
  } catch {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
}

module.exports = { verifyBearer };
