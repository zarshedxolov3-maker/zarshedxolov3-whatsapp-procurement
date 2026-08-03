/**
 * Captures the raw request body buffer so the signature verifier
 * can compute HMAC-SHA256 over the exact bytes Meta signed.
 * Must be registered BEFORE express.json().
 */
function captureRawBody(req, res, next) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  req.on('error', next);
}

module.exports = { captureRawBody };
