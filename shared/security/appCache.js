/**
 * Simple TTL in-memory cache for read-heavy, rarely-changing data.
 * No external dependencies. Thread-safe for single-process Node.
 *
 * Usage:
 *   const cache = require('./appCache');
 *   const val = await cache.getOrFetch('key', ttlSeconds, asyncFn);
 */

const store = new Map();

function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.exp) { store.delete(key); return undefined; }
    return entry.val;
}

function set(key, val, ttlSeconds = 60) {
    store.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
}

function del(key) { store.delete(key); }

function flush() { store.clear(); }

/** Preferred API — returns cached value or calls fetcher and stores result. */
async function getOrFetch(key, ttlSeconds, fetcher) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const fresh = await fetcher();
    set(key, fresh, ttlSeconds);
    return fresh;
}

/** Express middleware factory: caches GET responses by full URL. */
function routeCache(ttlSeconds = 60) {
    return (req, res, next) => {
        if (req.method !== 'GET') return next();
        const key = `route:${req.originalUrl}`;
        const cached = get(key);
        if (cached !== undefined) {
            return res.json(cached);
        }
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200) set(key, body, ttlSeconds);
            return originalJson(body);
        };
        next();
    };
}

module.exports = { get, set, del, flush, getOrFetch, routeCache };
