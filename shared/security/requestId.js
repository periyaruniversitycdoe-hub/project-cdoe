/**
 * Request ID Middleware
 * Stamps every request with a unique ID for forensic correlation across layers.
 * Format: <portal>-<timestamp_ms>-<random_hex8>
 *
 * The ID is attached to:
 *   - req.requestId (all downstream code)
 *   - X-Request-ID response header (client can correlate with support)
 *   - X-Request-ID forwarded to proxied services
 */
const crypto = require('crypto');

function requestId(portalPrefix = 'api') {
    return (req, res, next) => {
        const incoming = req.headers['x-request-id'];
        // Re-use the gateway's ID if already stamped, else mint a new one
        const id = (incoming && /^[a-z]+-\d+-[0-9a-f]{8}$/i.test(incoming))
            ? incoming
            : `${portalPrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        req.requestId = id;
        res.setHeader('X-Request-ID', id);
        next();
    };
}

module.exports = requestId;
